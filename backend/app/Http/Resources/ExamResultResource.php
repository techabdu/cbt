<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExamResultResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'exam_id'     => $this->exam_id,
            'student'     => $this->whenLoaded('student', fn () => [
                'id'            => $this->student->id,
                'matric_number' => $this->student->matric_number,
                'full_name'     => $this->student->full_name,
                'level'         => $this->student->level?->value,
            ]),
            'total_score' => (float) $this->total_score,
            'total_marks' => (float) $this->total_marks,
            'percentage'  => (float) $this->percentage,
            'grade'       => $this->grade,
            'is_absent'   => (bool) $this->is_absent,
            'synced_at'   => $this->synced_at?->toIso8601String(),
        ];
    }
}
