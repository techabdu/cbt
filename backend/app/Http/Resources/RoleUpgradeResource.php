<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RoleUpgradeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'user'        => $this->whenLoaded('user', fn () => $this->user ? [
                'id'          => $this->user->id,
                'name'        => $this->user->name,
                'file_number' => $this->user->file_number,
            ] : null),
            'from_role'   => $this->from_role?->value,
            'to_role'     => $this->to_role?->value,
            'reason'      => $this->reason,
            'upgraded_by' => $this->whenLoaded('upgradedBy', fn () => $this->upgradedBy ? [
                'id'   => $this->upgradedBy->id,
                'name' => $this->upgradedBy->name,
            ] : null),
            'created_at'  => $this->created_at?->toIso8601String(),
        ];
    }
}
