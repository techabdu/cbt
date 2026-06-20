<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class QuestionBankResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'               => $this->id,
            'lecturer_id'      => $this->lecturer_id,
            'course_id'        => $this->course_id,
            'course'           => $this->whenLoaded('course', fn () => new CourseResource($this->course)),
            'title'            => $this->title,
            'session'          => $this->session,
            'semester'         => $this->semester?->value,
            'total_questions'  => $this->total_questions,
            'status'           => $this->status->value,
            'rejection_reason' => $this->rejection_reason,
            'submitted_at'     => $this->submitted_at?->toIso8601String(),
            'reviewed_at'      => $this->reviewed_at?->toIso8601String(),
            'reviewer'         => $this->whenLoaded('reviewer', fn () => $this->reviewer ? [
                'id'   => $this->reviewer->id,
                'name' => $this->reviewer->name,
            ] : null),
            'questions'        => QuestionResource::collection($this->whenLoaded('questions')),
            'is_editable'      => $this->status->isEditable(),
            'created_at'       => $this->created_at?->toIso8601String(),
            'updated_at'       => $this->updated_at?->toIso8601String(),
        ];
    }
}
