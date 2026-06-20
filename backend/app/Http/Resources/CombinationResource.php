<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CombinationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'school_id'       => $this->school_id,
            'name'            => $this->name,
            'code'            => $this->code,
            'departments'     => $this->whenLoaded('departments', fn () => DepartmentResource::collection($this->departments)),
            'students_count'  => $this->whenCounted('students'),
            'created_at'      => $this->created_at?->toIso8601String(),
        ];
    }
}
