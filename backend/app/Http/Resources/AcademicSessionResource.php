<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AcademicSessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'school_id'  => $this->school_id,
            'session'    => $this->session,
            'is_current' => $this->is_current,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
