<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExamResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'               => $this->id,
            'course_id'        => $this->course_id,
            'course'           => $this->whenLoaded('course', fn () => new CourseResource($this->course)),
            'question_bank_id' => $this->question_bank_id,
            'question_bank'    => $this->whenLoaded('questionBank', fn () => new QuestionBankResource($this->questionBank)),
            'session'          => $this->session,
            'semester'         => $this->semester?->value,
            'exam_date'        => $this->exam_date?->toDateString(),
            'start_time'       => $this->start_time,
            'duration_minutes' => $this->duration_minutes,
            'status'           => $this->status->value,
            'configured_by'    => $this->whenLoaded('configuredBy', fn () => $this->configuredBy ? [
                'id'   => $this->configuredBy->id,
                'name' => $this->configuredBy->name,
            ] : null),
            'codes_count'      => $this->whenCounted('codes'),
            'eligible_count'   => $this->when(isset($this->eligible_count), fn () => $this->eligible_count),
            'created_at'       => $this->created_at?->toIso8601String(),
        ];
    }
}
