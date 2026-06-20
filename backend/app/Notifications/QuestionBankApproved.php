<?php

namespace App\Notifications;

use App\Models\QuestionBank;
use Illuminate\Notifications\Notification;

class QuestionBankApproved extends Notification
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
        $courseCode = $this->bank->course?->code ?? 'your course';

        return [
            'title'    => 'Question bank approved',
            'message'  => "Your question bank for {$courseCode} was approved and is ready for exam setup.",
            'category' => 'approved',
            'link'     => "/dashboard/lecturer/question-banks/{$this->bank->id}",
            'question_bank_id' => $this->bank->id,
        ];
    }
}
