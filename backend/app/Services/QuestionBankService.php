<?php

namespace App\Services;

use App\Enums\QuestionBankStatus;
use App\Enums\QuestionType;
use App\Enums\UserRole;
use App\Models\Question;
use App\Models\QuestionBank;
use App\Models\User;
use App\Notifications\QuestionBankSubmittedForModeration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

class QuestionBankService
{
    public function __construct(
        private readonly AuditLogService $auditLog,
    ) {}

    /**
     * Create a new (draft) question bank for a course the lecturer teaches.
     */
    public function createBank(User $lecturer, array $data, ?string $ip = null): QuestionBank
    {
        $bank = QuestionBank::create([
            'lecturer_id'     => $lecturer->id,
            'course_id'       => $data['course_id'],
            'title'           => $data['title'] ?? null,
            'session'         => $data['session'],
            'semester'        => $data['semester'],
            'total_questions' => 0,
            'status'          => QuestionBankStatus::Draft,
        ]);

        $this->auditLog->log('question_bank_created', $lecturer, QuestionBank::class, $bank->id,
            newValues: ['course_id' => $bank->course_id, 'session' => $bank->session],
            ipAddress: $ip);

        return $bank;
    }

    /**
     * Update a draft/rejected bank's metadata.
     */
    public function updateBank(QuestionBank $bank, array $data, ?User $actor = null, ?string $ip = null): QuestionBank
    {
        $this->assertEditable($bank);

        $bank->update([
            'title'    => $data['title'] ?? $bank->title,
            'session'  => $data['session'] ?? $bank->session,
            'semester' => $data['semester'] ?? $bank->semester,
        ]);

        return $bank;
    }

    /**
     * Add a question (with its type-specific options/answers) to a bank.
     * Wrapped in a transaction so a partial question can never be persisted.
     */
    public function addQuestion(QuestionBank $bank, array $data): Question
    {
        $this->assertEditable($bank);

        return DB::transaction(function () use ($bank, $data) {
            $nextOrder = (int) $bank->questions()->max('order_index') + 1;

            $question = $bank->questions()->create([
                'question_text' => $data['question_text'],
                'question_type' => $data['question_type'],
                'marks'         => $data['marks'] ?? 1,
                'order_index'   => $nextOrder,
            ]);

            $this->syncQuestionDetails($question, $data);

            $this->refreshTotal($bank);

            return $question->load(['options', 'answers']);
        });
    }

    /**
     * Replace a question's text/type and its options/answers.
     */
    public function updateQuestion(Question $question, array $data): Question
    {
        $bank = $question->questionBank;
        $this->assertEditable($bank);

        return DB::transaction(function () use ($question, $data, $bank) {
            $question->update([
                'question_text' => $data['question_text'],
                'question_type' => $data['question_type'],
                'marks'         => $data['marks'] ?? $question->marks,
            ]);

            // Clear and rebuild type-specific detail rows.
            $question->options()->delete();
            $question->answers()->delete();
            $this->syncQuestionDetails($question, $data);

            $this->refreshTotal($bank);

            return $question->load(['options', 'answers']);
        });
    }

    /**
     * Delete a question and re-sequence the remaining ones.
     */
    public function deleteQuestion(Question $question): void
    {
        $bank = $question->questionBank;
        $this->assertEditable($bank);

        DB::transaction(function () use ($question, $bank) {
            $question->delete();

            // Re-pack order_index so there are no gaps.
            $bank->questions()->orderBy('order_index')->get()
                ->each(fn (Question $q, int $i) => $q->update(['order_index' => $i + 1]));

            $this->refreshTotal($bank);
        });
    }

    /**
     * Submit a bank for moderation. Requires at least one question.
     */
    public function submit(QuestionBank $bank, ?User $actor = null, ?string $ip = null): QuestionBank
    {
        $this->assertEditable($bank);

        if ($bank->questions()->count() === 0) {
            throw ValidationException::withMessages([
                'questions' => 'Add at least one question before submitting for moderation.',
            ]);
        }

        $bank->update([
            'status'           => QuestionBankStatus::Submitted,
            'submitted_at'     => now(),
            'rejection_reason' => null,
            'reviewed_at'      => null,
            'reviewed_by'      => null,
        ]);

        $this->auditLog->log('question_bank_submitted', $actor ?? $bank->lecturer,
            QuestionBank::class, $bank->id, ipAddress: $ip);

        // Tell the school's exam officer(s) there is something to moderate.
        $schoolId = $bank->lecturer?->school_id;
        if ($schoolId) {
            $officers = User::where('role', UserRole::ExamOfficer->value)
                ->where('school_id', $schoolId)
                ->where('is_active', true)
                ->get();

            Notification::send($officers, new QuestionBankSubmittedForModeration($bank));
        }

        return $bank;
    }

    /**
     * Persist the type-specific detail rows for a freshly created/updated question.
     */
    private function syncQuestionDetails(Question $question, array $data): void
    {
        $type = $question->question_type;

        if ($type === QuestionType::Mcq) {
            foreach (array_values($data['options']) as $i => $option) {
                $question->options()->create([
                    'option_label' => chr(65 + $i), // A, B, C, D, …
                    'option_text'  => $option['option_text'],
                    'is_correct'   => (bool) ($option['is_correct'] ?? false),
                ]);
            }
        } elseif ($type === QuestionType::TrueFalse) {
            $correct = $data['correct_answer']; // 'true' | 'false' (string)
            $isTrue  = filter_var($correct, FILTER_VALIDATE_BOOLEAN);

            $question->options()->create([
                'option_label' => 'T', 'option_text' => 'True',  'is_correct' => $isTrue,
            ]);
            $question->options()->create([
                'option_label' => 'F', 'option_text' => 'False', 'is_correct' => ! $isTrue,
            ]);
        } else { // FillBlank
            foreach ($data['answers'] as $answer) {
                $trimmed = trim((string) $answer);
                if ($trimmed !== '') {
                    $question->answers()->create(['correct_answer' => $trimmed]);
                }
            }
        }
    }

    private function refreshTotal(QuestionBank $bank): void
    {
        $bank->update(['total_questions' => $bank->questions()->count()]);
    }

    private function assertEditable(QuestionBank $bank): void
    {
        if (! $bank->status->isEditable()) {
            throw ValidationException::withMessages([
                'status' => 'This question bank is locked and can no longer be edited.',
            ]);
        }
    }
}
