<?php

namespace App\Notifications;

use App\Models\QuestionBank;
use Illuminate\Notifications\Notification;

class QuestionBankRejected extends Notification
{
    public function __construct(
        private readonly QuestionBank $bank,
        private readonly string $reason,
    ) {}

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
        $courseCode = $this->bank->course?->code ?? 'your course';

        return [
            'title'    => 'Question bank returned for revision',
            'message'  => "Your question bank for {$courseCode} needs changes: {$this->reason}",
            'category' => 'rejected',
            'link'     => "/dashboard/lecturer/question-banks/{$this->bank->id}",
            'question_bank_id' => $this->bank->id,
            'reason'   => $this->reason,
        ];
    }
}
