<?php

namespace App\Services;

use App\Enums\ExamStatus;
use App\Enums\QuestionBankStatus;
use App\Models\Exam;
use App\Models\QuestionBank;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class ExamConfigurationService
{
    public function __construct(
        private readonly AuditLogService $auditLog,
    ) {}

    /**
     * Configure an exam from an approved question bank. Session + semester and the
     * course are inherited from the bank to keep everything consistent.
     */
    public function create(array $data, User $actor, ?string $ip = null): Exam
    {
        /** @var QuestionBank $bank */
        $bank = QuestionBank::findOrFail($data['question_bank_id']);

        if ($bank->status !== QuestionBankStatus::Approved) {
            throw ValidationException::withMessages([
                'question_bank_id' => 'You can only build an exam from an approved question bank.',
            ]);
        }

        $exam = Exam::create([
            'course_id'        => $bank->course_id,
            'question_bank_id' => $bank->id,
            'session'          => $bank->session,
            'semester'         => $bank->semester,
            'exam_date'        => $data['exam_date'],
            'start_time'       => $data['start_time'],
            'duration_minutes' => $data['duration_minutes'],
            'status'           => ExamStatus::Scheduled,
            'configured_by'    => $actor->id,
        ]);

        $this->auditLog->log('exam_configured', $actor, Exam::class, $exam->id,
            newValues: ['course_id' => $exam->course_id, 'question_bank_id' => $bank->id],
            ipAddress: $ip);

        return $exam;
    }

    /**
     * Update timing details. Only permitted while the exam is still scheduled
     * (i.e. not yet pushed to the offline server).
     */
    public function update(Exam $exam, array $data, User $actor, ?string $ip = null): Exam
    {
        $this->assertScheduled($exam);

        $exam->update([
            'exam_date'        => $data['exam_date'] ?? $exam->exam_date,
            'start_time'       => $data['start_time'] ?? $exam->start_time,
            'duration_minutes' => $data['duration_minutes'] ?? $exam->duration_minutes,
        ]);

        $this->auditLog->log('exam_updated', $actor, Exam::class, $exam->id, ipAddress: $ip);

        return $exam;
    }

    public function delete(Exam $exam, User $actor, ?string $ip = null): void
    {
        $this->assertScheduled($exam);

        $this->auditLog->log('exam_deleted', $actor, Exam::class, $exam->id,
            oldValues: ['course_id' => $exam->course_id], ipAddress: $ip);

        $exam->delete();
    }

    private function assertScheduled(Exam $exam): void
    {
        if ($exam->status !== ExamStatus::Scheduled) {
            throw ValidationException::withMessages([
                'status' => 'This exam has already been synced and can no longer be changed.',
            ]);
        }
    }
}
