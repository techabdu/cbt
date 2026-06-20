<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExamCodeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'exam_id'    => $this->exam_id,
            'student_id' => $this->student_id,
            'student'    => $this->whenLoaded('student', fn () => [
                'id'            => $this->student->id,
                'matric_number' => $this->student->matric_number,
                'full_name'     => $this->student->full_name,
            ]),
            'code'       => $this->code,
            'is_used'    => $this->is_used,
            'used_at'    => $this->used_at?->toIso8601String(),
        ];
    }
}
