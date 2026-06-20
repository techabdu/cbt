<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SyncLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                => $this->id,
            'exam_id'           => $this->exam_id,
            'exam'              => $this->whenLoaded('exam', fn () => $this->exam ? [
                'id'     => $this->exam->id,
                'course' => $this->exam->course?->code,
            ] : null),
            'direction'         => $this->direction?->value,
            'status'            => $this->status?->value,
            'target_server_url' => $this->target_server_url,
            'payload_summary'   => $this->payload_summary,
            'error_message'     => $this->error_message,
            'initiated_by'      => $this->whenLoaded('initiatedBy', fn () => $this->initiatedBy?->name),
            'synced_at'         => $this->synced_at?->toIso8601String(),
            'created_at'        => $this->created_at?->toIso8601String(),
        ];
    }
}
