<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DepartmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'school_id'      => $this->school_id,
            'name'           => $this->name,
            'code'           => $this->code,
            'full_name'      => $this->full_name,
            'courses_count'  => $this->whenCounted('courses'),
            'students_count' => $this->whenCounted('students'),
            'created_at'     => $this->created_at?->toIso8601String(),
        ];
    }
}
