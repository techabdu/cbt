<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StudentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'matric_number'  => $this->matric_number,
            'full_name'      => $this->full_name,
            'department_id'  => $this->department_id,
            'department'     => $this->whenLoaded('department', fn () => new DepartmentResource($this->department)),
            'combination_id' => $this->combination_id,
            'combination'    => $this->whenLoaded('combination', fn () => new CombinationResource($this->combination)),
            'school_id'      => $this->school_id,
            'level'          => $this->level?->value,
            'photo_path'     => $this->photo_path,
            'is_active'      => $this->is_active,
            'created_at'     => $this->created_at?->toIso8601String(),
        ];
    }
}
