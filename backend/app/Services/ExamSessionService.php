<?php

namespace App\Services;

use App\Enums\QuestionType;
use App\Jobs\GradeExamSession;
use App\Models\Exam;
use App\Models\ExamCode;
use App\Models\ExamSession;
use App\Models\Question;
use App\Models\StudentAnswer;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Validation\ValidationException;

class ExamSessionService
{
    /** How long the rendered question payload stays cached (exams are immutable once codes exist). */
    private const QUESTIONS_TTL_SECONDS = 43200; // 12 hours

    /**
     * How long past ends_at the server still accepts answer writes. Must stay
     * greater than the frontend's 60s bulk-autosave interval (+ debounce and
     * network slack), so a final flush sent at expiry is never rejected.
     */
    private const EXPIRY_GRACE_SECONDS = 120;

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

        $exam = $examCode->exam;
        $student = $examCode->student;

        $session = ExamSession::firstOrNew([
            'exam_id' => $exam->id,
            'student_id' => $student->id,
        ]);

        if ($session->submitted_at) {
            throw ValidationException::withMessages([
                'exam_code' => 'You have already submitted this exam.',
            ]);
        }

        if (! $session->exists) {
            $session->started_at = now();

            try {
                $session->save();
            } catch (UniqueConstraintViolationException) {
                // Double-click / double-tab race: a parallel login inserted the
                // row first — adopt it. Both requests get tokens for the same
                // session, which is fine (tokens are stateless claims on its id).
                $session = ExamSession::where('exam_id', $exam->id)
                    ->where('student_id', $student->id)
                    ->firstOrFail();
            }

            $examCode->update(['is_used' => true, 'used_at' => now()]);
        }

        return [
            'token' => $this->issueToken($session),
            'session' => $this->sessionMeta($session, $exam),
            'student' => [
                'matric_number' => $student->matric_number,
                'full_name' => $student->full_name,
            ],
            'questions' => $this->studentQuestions($exam, $student->id),
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
            'session' => $this->sessionMeta($session, $exam),
            'student' => [
                'matric_number' => $session->student->matric_number,
                'full_name' => $session->student->full_name,
            ],
            'questions' => $this->studentQuestions($exam, $session->student_id),
            'saved_answers' => $this->savedAnswers($session),
        ];
    }

    /**
     * Persist a single answer (raw, ungraded). Idempotent upsert per question.
     */
    public function saveAnswer(ExamSession $session, int $questionId, ?string $answer, int $orderIndex = 0): void
    {
        $this->assertOpen($session);

        // Guard against unknown question ids using the cached id set (no DB hit).
        if (! in_array($questionId, $this->examQuestionIds($session->exam), true)) {
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

        $validIds = $this->examQuestionIds($session->exam);
        $now = now();

        $rows = [];
        foreach ($answers as $a) {
            $questionId = (int) $a['question_id'];

            // Skip unknown ids silently — a bulk autosave shouldn't fail the whole
            // batch over one stray id. Keyed by id so a duplicate keeps the last write.
            if (! in_array($questionId, $validIds, true)) {
                continue;
            }

            $rows[$questionId] = [
                'exam_session_id' => $session->id,
                'question_id' => $questionId,
                'student_answer' => $a['answer'] ?? null,
                'order_index' => (int) ($a['order_index'] ?? 0),
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        if (! $rows) {
            return;
        }

        // One upsert for the whole batch instead of a select+write per answer.
        // Relies on the unique (exam_session_id, question_id) index.
        StudentAnswer::upsert(
            array_values($rows),
            ['exam_session_id', 'question_id'],
            ['student_answer', 'order_index', 'updated_at'],
        );
    }

    /**
     * Finalise the exam: mark submitted, queue grading, and return the
     * (student-safe) outcome. Grading runs asynchronously on the offline server's
     * worker pool; scores are released later regardless.
     *
     * @return array<string, mixed>
     */
    public function submit(ExamSession $session, bool $autoSubmitted = false): array
    {
        // A submit is never rejected for lateness — a slow client must not lose
        // graded work. Past the grace window it is force-flagged auto-submitted.
        $this->assertNotSubmitted($session);

        $session->update([
            'submitted_at' => now(),
            'is_auto_submitted' => $autoSubmitted || now()->gt($this->expiresAt($session)),
        ]);

        // Grade off the request thread. At exam end every student's timer hits
        // zero together, so grading inline would land thousands of full-bank
        // grading passes on the workers at once. The job is queued with a small
        // random delay to spread that spike; results are released later anyway.
        // (Under the sync queue used in tests this runs inline, so behaviour and
        // assertions are unchanged.)
        GradeExamSession::dispatch($session->id)
            ->delay(now()->addSeconds(random_int(0, 20)));

        return [
            'submitted_at' => $session->submitted_at->toIso8601String(),
            'auto' => $autoSubmitted,
            // Students are told they are done, not their score (released later).
            'message' => 'Your exam has been submitted successfully.',
            'answered' => $session->answers()->whereNotNull('student_answer')->count(),
            'total' => count($this->examQuestionIds($session->exam)),
            'status' => 'grading',
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

        // Hot path (answer/autosave/submit): only the session + its exam are
        // needed. The exam's questions come from cache, and student/questionBank
        // relations lazy-load on the rare paths that touch them (resume).
        return ExamSession::with('exam')->find($payload['sid']);
    }

    /**
     * When the server stops accepting answer writes for a session: the exam's
     * ends_at plus the grace window (the client-facing ends_at excludes grace).
     */
    public function expiresAt(ExamSession $session): Carbon
    {
        return Carbon::parse($session->started_at ?? now())
            ->addMinutes($session->exam->duration_minutes)
            ->addSeconds(self::EXPIRY_GRACE_SECONDS);
    }

    /**
     * Force-submit every open session whose time (plus grace) has run out, so a
     * crashed browser that never auto-submitted still gets graded. Returns the
     * number of sessions closed. Idempotent; runs from the scheduler.
     */
    public function sweepExpiredSessions(): int
    {
        $count = 0;

        ExamSession::with('exam')
            ->whereNull('submitted_at')
            ->whereNotNull('started_at')
            ->chunkById(200, function ($sessions) use (&$count) {
                foreach ($sessions as $session) {
                    // Expiry is compared in PHP (not SQL date math) because
                    // duration lives on the exam row and portability matters.
                    if (now()->lte($this->expiresAt($session))) {
                        continue;
                    }

                    try {
                        $this->submit($session, autoSubmitted: true);
                        $count++;
                    } catch (ValidationException) {
                        // Lost the race with the student's own submit — fine.
                    }
                }
            });

        return $count;
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function assertOpen(ExamSession $session): void
    {
        $this->assertNotSubmitted($session);

        if (now()->gt($this->expiresAt($session))) {
            throw ValidationException::withMessages([
                'session' => 'Time is up — this exam is no longer accepting answers.',
            ]);
        }
    }

    private function assertNotSubmitted(ExamSession $session): void
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
        $endsAt = Carbon::parse($startedAt)->addMinutes($exam->duration_minutes);

        return [
            'id' => $session->id,
            'exam_id' => $exam->id,
            'duration_minutes' => $exam->duration_minutes,
            'started_at' => Carbon::parse($startedAt)->toIso8601String(),
            'ends_at' => $endsAt->toIso8601String(),
            'server_time' => now()->toIso8601String(),
            'submitted_at' => $session->submitted_at?->toIso8601String(),
        ];
    }

    /**
     * Questions shuffled deterministically per student, stripped of any
     * answer-revealing fields. The base (unshuffled) payload is built once per
     * exam and cached, so 5,000 logins don't each re-read the whole bank.
     *
     * @return array<int, array<string, mixed>>
     */
    private function studentQuestions(Exam $exam, int $studentId): array
    {
        $base = $this->examQuestionPayload($exam);

        // Deterministic per-student order so reloads keep the same sequence.
        // (Collection::shuffle() dropped its seed argument, so we shuffle with a
        // seeded Fisher–Yates instead of relying on it.)
        $ordered = $this->seededShuffle($base, crc32($studentId.'-'.$exam->id));

        $position = 1;
        foreach ($ordered as &$question) {
            $question['position'] = $position++;
        }
        unset($question);

        return $ordered;
    }

    /**
     * The answer-stripped question payload for an exam, built once and cached.
     * Order is the canonical (unshuffled) order_index; per-student shuffling is
     * applied on top in studentQuestions().
     *
     * A cold key at exam start would let ~1000 simultaneous logins each rebuild
     * the payload (a full question-bank read), so the rebuild is guarded by an
     * atomic lock: one request builds, the rest block briefly then read the
     * fresh cache. The cache is also pre-warmed when an exam package is
     * imported (warmQuestionCache), so this path is normally already hot.
     *
     * @return array<int, array<string, mixed>>
     */
    private function examQuestionPayload(Exam $exam): array
    {
        $key = self::questionsCacheKey($exam->id);

        $cached = Cache::get($key);
        if ($cached !== null) {
            return $cached;
        }

        try {
            return Cache::lock($key.':build', 20)->block(15, fn () => Cache::remember(
                $key,
                self::QUESTIONS_TTL_SECONDS,
                fn () => $this->buildQuestionPayload($exam),
            ));
        } catch (LockTimeoutException) {
            // Couldn't get the lock in time — serve a direct read rather than 500.
            return $this->buildQuestionPayload($exam);
        }
    }

    /**
     * Build (and cache) the payload eagerly — called when an exam package is
     * imported so the first login of the day never pays the rebuild.
     */
    public function warmQuestionCache(Exam $exam): void
    {
        Cache::put(
            self::questionsCacheKey($exam->id),
            $this->buildQuestionPayload($exam),
            self::QUESTIONS_TTL_SECONDS,
        );
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildQuestionPayload(Exam $exam): array
    {
        return $exam->questionBank->questions()->with('options')->orderBy('order_index')->get()
            ->map(function (Question $q) {
                $options = $q->question_type === QuestionType::FillBlank
                    ? []
                    : $q->options->sortBy('option_label')->values()->map(fn ($o) => [
                        'label' => $o->option_label,
                        'text' => $o->option_text,
                    ])->all();

                return [
                    'id' => $q->id,
                    'question_text' => $q->question_text,
                    'question_type' => $q->question_type->value,
                    'marks' => $q->marks,
                    'options' => $options,
                ];
            })->all();
    }

    /**
     * Valid question ids for an exam, derived from the cached payload — used to
     * validate incoming answers without a DB round trip per save.
     *
     * @return array<int, int>
     */
    private function examQuestionIds(Exam $exam): array
    {
        return array_column($this->examQuestionPayload($exam), 'id');
    }

    public static function questionsCacheKey(int $examId): string
    {
        return "exam:{$examId}:questions";
    }

    /**
     * Drop the cached payload — call when an exam's questions change (e.g. a new
     * exam package is imported/synced onto the offline server).
     */
    public static function forgetQuestionCache(int $examId): void
    {
        Cache::forget(self::questionsCacheKey($examId));
    }

    /**
     * Deterministic Fisher–Yates shuffle seeded by $seed (same seed → same order).
     *
     * @param  array<int, mixed>  $items
     * @return array<int, mixed>
     */
    private function seededShuffle(array $items, int $seed): array
    {
        mt_srand($seed);

        for ($i = count($items) - 1; $i > 0; $i--) {
            $j = mt_rand(0, $i);
            [$items[$i], $items[$j]] = [$items[$j], $items[$i]];
        }

        mt_srand(); // restore unseeded randomness for the rest of the request

        return $items;
    }

    /**
     * @return array<int, string|null> keyed by question_id
     */
    private function savedAnswers(ExamSession $session): array
    {
        return $session->answers()
            ->get()
            ->mapWithKeys(fn ($a) => [$a->question_id => $a->student_answer])
            ->all();
    }
}
