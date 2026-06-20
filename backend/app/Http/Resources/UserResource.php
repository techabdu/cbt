<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                    => $this->id,
            'file_number'           => $this->file_number,
            'name'                  => $this->name,
            'email'                 => $this->email,
            'role'                  => $this->role->value,
            'role_label'            => $this->role->label(),
            'school_id'             => $this->school_id,
            'department_id'         => $this->department_id,
            'department'            => $this->whenLoaded('department', fn () => new DepartmentResource($this->department)),
            'is_active'             => $this->is_active,
            'force_password_change' => $this->force_password_change,
            'last_login_at'         => $this->last_login_at?->toIso8601String(),
        ];
    }
}
