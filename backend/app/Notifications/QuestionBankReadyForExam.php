<?php

namespace App\Notifications;

use App\Models\QuestionBank;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Queue\SerializesModels;

/**
 * Sent to CBT Admins once an Exam Officer approves a bank, signalling that it is
 * available to configure into an exam.
 */
class QuestionBankReadyForExam extends Notification implements ShouldQueue
{
    use Queueable;
    use SerializesModels;

    public function __construct(private readonly QuestionBank $bank) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $courseCode = $this->bank->course?->code ?? 'a course';
        $lecturer = $this->bank->lecturer?->name ?? 'a lecturer';

        return [
            'title' => 'Approved bank ready for exam setup',
            'message' => "{$lecturer}'s question bank for {$courseCode} has been approved and can be configured into an exam.",
            'category' => 'info',
            'link' => '/dashboard/cbt-admin/question-banks',
            'question_bank_id' => $this->bank->id,
        ];
    }
}
