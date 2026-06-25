<?php

namespace App\Notifications;

use App\Models\Exam;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Queue\SerializesModels;

class ExamResultsAvailable extends Notification implements ShouldQueue
{
    use Queueable;
    use SerializesModels;

    public function __construct(private readonly Exam $exam) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        $course = $this->exam->course;
        $label = $course ? "{$course->code} ({$this->exam->session})" : "Exam #{$this->exam->id}";

        return [
            'title' => 'Results available',
            'message' => "Results for {$label} have been synced and are ready to view.",
            'category' => 'results',
            'link' => "/dashboard/lecturer/results/{$this->exam->id}",
            'exam_id' => $this->exam->id,
        ];
    }
}
