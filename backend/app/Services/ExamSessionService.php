<?php

namespace App\Services;

use App\Enums\QuestionType;
use App\Models\Exam;
use App\Models\ExamCode;
use App\Models\ExamSession;
use App\Models\Question;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ExamSessionService
{
    public function __construct(
        private readonly AutoGradingService $grading,
    ) {}

    /**
     * Authenticate a student by matric number + exam code and start (or resume)
     * their exam session. Returns the session, a stateless token, the shuffled
     * question set (without answers) and any previously-saved answers.
     *
     * @return array<string, mixed>
     */
    public function login(string $matricNumber, string $code): array
    {
        $examCode = ExamCode::query()
            ->where('code', strtoupper(trim($code)))
            ->whereHas('student', fn ($q) => $q->where('matric_number', trim($matricNumber)))
            ->with(['exam', 'student'])
            ->first();

        if (! $examCode) {
            throw ValidationException::withMessages([
                'exam_code' => 'Invalid matric number or exam code.',
            ]);
        }

        $exam    = $examCode->exam;
        $student = $examCode->student;

        $session = ExamSession::firstOrNew([
            'exam_id'    => $exam->id,
            'student_id' => $student->id,
        ]);

        if ($session->submitted_at) {
            throw ValidationException::withMessages([
                'exam_code' => 'You have already submitted this exam.',
            ]);
        }

        if (! $session->exists) {
            $session->started_at = now();
            $session->save();

            $examCode->update(['is_used' => true, 'used_at' => now()]);
        }

        return [
            'token'         => $this->issueToken($session),
            'session'       => $this->sessionMeta($session, $exam),
            'student'       => [
                'matric_number' => $student->matric_number,
                'full_name'     => $student->full_name,
            ],
            'questions'     => $this->studentQuestions($exam, $student->id),
            'saved_answers' => $this->savedAnswers($session),
        ];
    }

    /**
     * Resume data for a F5 / reconnect, keyed off the token-resolved session.
     *
     * @return array<string, mixed>
     */
    public function resume(ExamSession $session): array
    {
        $exam = $session->exam;

        return [
            'session'       => $this->sessionMeta($session, $exam),
            'student'       => [
                'matric_number' => $session->student->matric_number,
                'full_name'     => $session->student->full_name,
            ],
            'questions'     => $this->studentQuestions($exam, $session->student_id),
            'saved_answers' => $this->savedAnswers($session),
        ];
    }

    /**
     * Persist a single answer (raw, ungraded). Idempotent upsert per question.
     */
    public function saveAnswer(ExamSession $session, int $questionId, ?string $answer, int $orderIndex = 0): void
    {
        $this->assertOpen($session);

        // Guard: the question must belong to this exam's bank.
        $belongs = Question::where('id', $questionId)
            ->where('question_bank_id', $session->exam->question_bank_id)
            ->exists();

        if (! $belongs) {
            throw ValidationException::withMessages(['question_id' => 'Unknown question.']);
        }

        $session->answers()->updateOrCreate(
            ['question_id' => $questionId],
            ['student_answer' => $answer, 'order_index' => $orderIndex],
        );
    }

    /**
     * Bulk autosave used by the periodic background save.
     *
     * @param  array<int, array{question_id:int, answer:?string, order_index?:int}>  $answers
     */
    public function saveAnswers(ExamSession $session, array $answers): void
    {
        $this->assertOpen($session);

        DB::transaction(function () use ($session, $answers): void {
            foreach ($answers as $a) {
                $this->saveAnswer($session, (int) $a['question_id'], $a['answer'] ?? null, (int) ($a['order_index'] ?? 0));
            }
        });
    }

    /**
     * Finalise the exam: mark submitted, grade, and return the (student-safe)
     * outcome. Grading happens immediately on the offline server.
     *
     * @return array<string, mixed>
     */
    public function submit(ExamSession $session, bool $autoSubmitted = false): array
    {
        $this->assertOpen($session);

        $session->update([
            'submitted_at'      => now(),
            'is_auto_submitted' => $autoSubmitted,
        ]);

        $result = $this->grading->gradeSession($session);

        return [
            'submitted_at' => $session->submitted_at->toIso8601String(),
            'auto'         => $autoSubmitted,
            // Students are told they are done, not their score (released later).
            'message'      => 'Your exam has been submitted successfully.',
            'answered'     => $session->answers()->whereNotNull('student_answer')->count(),
            'total'        => $session->exam->questionBank->questions()->count(),
            'result_id'    => $result->id,
        ];
    }

    // ── Token helpers ─────────────────────────────────────────────────────────

    public function issueToken(ExamSession $session): string
    {
        return Crypt::encryptString(json_encode([
            'sid' => $session->id,
            'eid' => $session->exam_id,
            'stid' => $session->student_id,
        ]));
    }

    public function resolveToken(string $token): ?ExamSession
    {
        try {
            $payload = json_decode(Crypt::decryptString($token), true);
        } catch (\Throwable) {
            return null;
        }

        if (! isset($payload['sid'])) {
            return null;
        }

        return ExamSession::with(['exam.questionBank', 'student'])->find($payload['sid']);
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function assertOpen(ExamSession $session): void
    {
        if ($session->submitted_at) {
            throw ValidationException::withMessages([
                'session' => 'This exam has already been submitted.',
            ]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function sessionMeta(ExamSession $session, Exam $exam): array
    {
        $startedAt = $session->started_at ?? now();
        $endsAt    = Carbon::parse($startedAt)->addMinutes($exam->duration_minutes);

        return [
            'id'               => $session->id,
            'exam_id'          => $exam->id,
            'duration_minutes' => $exam->duration_minutes,
            'started_at'       => Carbon::parse($startedAt)->toIso8601String(),
            'ends_at'          => $endsAt->toIso8601String(),
            'server_time'      => now()->toIso8601String(),
            'submitted_at'     => $session->submitted_at?->toIso8601String(),
        ];
    }

    /**
     * Questions shuffled deterministically per student, stripped of any
     * answer-revealing fields.
     *
     * @return array<int, array<string, mixed>>
     */
    private function studentQuestions(Exam $exam, int $studentId): array
    {
        $questions = $exam->questionBank->questions()->with('options')->orderBy('order_index')->get();

        // Deterministic per-student order so reloads keep the same sequence.
        $seed = crc32($studentId.'-'.$exam->id);

        return $questions->shuffle($seed)->values()->map(function (Question $q, int $i) {
            $options = $q->question_type === QuestionType::FillBlank
                ? []
                : $q->options->sortBy('option_label')->values()->map(fn ($o) => [
                    'label' => $o->option_label,
                    'text'  => $o->option_text,
                ])->all();

            return [
                'id'            => $q->id,
                'position'      => $i + 1,
                'question_text' => $q->question_text,
                'question_type' => $q->question_type->value,
                'marks'         => $q->marks,
                'options'       => $options,
            ];
        })->all();
    }

    /**
     * @return array<int, string|null>  keyed by question_id
     */
    private function savedAnswers(ExamSession $session): array
    {
        return $session->answers()
            ->get()
            ->mapWithKeys(fn ($a) => [$a->question_id => $a->student_answer])
            ->all();
    }
}
