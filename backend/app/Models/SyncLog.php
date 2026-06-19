<?php

namespace App\Models;

use App\Enums\SyncDirection;
use App\Enums\SyncStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SyncLog extends Model
{
    protected $fillable = [
        'exam_id',
        'direction',
        'status',
        'initiated_by',
        'target_server_url',
        'payload_summary',
        'synced_at',
        'error_message',
    ];

    protected function casts(): array
    {
        return [
            'direction' => SyncDirection::class,
            'status' => SyncStatus::class,
            'payload_summary' => 'array',
            'synced_at' => 'datetime',
        ];
    }

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    public function initiatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'initiated_by');
    }
}
