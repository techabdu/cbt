<?php

namespace App\Notifications;

use App\Models\QuestionBank;
use Illuminate\Notifications\Notification;

class QuestionBankSubmittedForModeration extends Notification
{
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
        $lecturer   = $this->bank->lecturer?->name ?? 'A lecturer';

        return [
            'title'    => 'Question bank awaiting moderation',
            'message'  => "{$lecturer} submitted a question bank for {$courseCode}. Review it to approve or reject.",
            'category' => 'moderation',
            'link'     => "/dashboard/exam-officer/moderation/{$this->bank->id}",
            'question_bank_id' => $this->bank->id,
        ];
    }
}
