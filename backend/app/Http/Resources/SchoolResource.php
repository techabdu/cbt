<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SchoolResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                => $this->id,
            'college_id'        => $this->college_id,
            'name'              => $this->name,
            'code'              => $this->code,
            'head_name'         => $this->head_name,
            'departments_count' => $this->whenCounted('departments'),
            'students_count'    => $this->whenCounted('students'),
            'users_count'       => $this->whenCounted('users'),
            'created_at'        => $this->created_at?->toIso8601String(),
        ];
    }
}
