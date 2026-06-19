<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;

class AuditLogService
{
    public function log(
        string $action,
        ?User $user = null,
        ?string $modelType = null,
        int|string|null $modelId = null,
        array $oldValues = [],
        array $newValues = [],
        ?string $ipAddress = null,
    ): void {
        AuditLog::create([
            'user_id'    => $user?->id,
            'action'     => $action,
            'model_type' => $modelType,
            'model_id'   => $modelId,
            'old_values' => $oldValues ?: null,
            'new_values' => $newValues ?: null,
            'ip_address' => $ipAddress,
        ]);
    }
}
