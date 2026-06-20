<?php

namespace App\Services;

use App\Enums\QuestionBankStatus;
use App\Enums\UserRole;
use App\Models\QuestionBank;
use App\Models\User;
use App\Notifications\QuestionBankApproved;
use App\Notifications\QuestionBankReadyForExam;
use App\Notifications\QuestionBankRejected;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

class ModerationService
{
    public function __construct(
        private readonly AuditLogService $auditLog,
    ) {}

    /**
     * Move a submitted bank into the "under review" state when an officer opens it.
     * No-op if it is already under review.
     */
    public function startReview(QuestionBank $bank, User $officer, ?string $ip = null): QuestionBank
    {
        if ($bank->status === QuestionBankStatus::Submitted) {
            $bank->update(['status' => QuestionBankStatus::UnderReview]);

            $this->auditLog->log('question_bank_review_started', $officer,
                QuestionBank::class, $bank->id, ipAddress: $ip);
        }

        return $bank;
    }

    /**
     * Approve a bank. Notifies the lecturer and every CBT Admin.
     */
    public function approve(QuestionBank $bank, User $officer, ?string $ip = null): QuestionBank
    {
        $this->assertModeratable($bank);

        $bank->update([
            'status'           => QuestionBankStatus::Approved,
            'reviewed_at'      => now(),
            'reviewed_by'      => $officer->id,
            'rejection_reason' => null,
        ]);

        // Notify the author.
        if ($bank->lecturer) {
            $bank->lecturer->notify(new QuestionBankApproved($bank));
        }

        // Notify all active CBT Admins that a bank is ready to configure.
        $cbtAdmins = User::query()
            ->where('role', UserRole::CbtAdmin->value)
            ->where('is_active', true)
            ->get();

        if ($cbtAdmins->isNotEmpty()) {
            Notification::send($cbtAdmins, new QuestionBankReadyForExam($bank));
        }

        $this->auditLog->log('question_bank_approved', $officer,
            QuestionBank::class, $bank->id,
            newValues: ['course_id' => $bank->course_id, 'lecturer_id' => $bank->lecturer_id],
            ipAddress: $ip);

        return $bank;
    }

    /**
     * Reject a bank with a reason. Notifies the lecturer; the bank becomes
     * editable again so they can revise and resubmit.
     */
    public function reject(QuestionBank $bank, User $officer, string $reason, ?string $ip = null): QuestionBank
    {
        $this->assertModeratable($bank);

        $bank->update([
            'status'           => QuestionBankStatus::Rejected,
            'reviewed_at'      => now(),
            'reviewed_by'      => $officer->id,
            'rejection_reason' => $reason,
        ]);

        if ($bank->lecturer) {
            $bank->lecturer->notify(new QuestionBankRejected($bank, $reason));
        }

        $this->auditLog->log('question_bank_rejected', $officer,
            QuestionBank::class, $bank->id,
            newValues: ['reason' => $reason],
            ipAddress: $ip);

        return $bank;
    }

    private function assertModeratable(QuestionBank $bank): void
    {
        if (! $bank->status->isModeratable()) {
            throw ValidationException::withMessages([
                'status' => 'This question bank is not awaiting moderation.',
            ]);
        }
    }
}
