<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CourseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'               => $this->id,
            'school_id'        => $this->school_id,
            'department_id'    => $this->department_id,
            'department'       => $this->whenLoaded('department', fn () => new DepartmentResource($this->department)),
            'title'            => $this->title,
            'code'             => $this->code,
            'credit_units'     => $this->credit_units,
            'level'            => $this->level?->value,
            'semester'         => $this->semester?->value,
            'lecturers_count'  => $this->whenCounted('lecturers'),
            'students_count'   => $this->whenCounted('students'),
            'created_at'       => $this->created_at?->toIso8601String(),
        ];
    }
}
