<?php

namespace App\Models;

use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RoleUpgrade extends Model
{
    protected $fillable = [
        'user_id',
        'from_role',
        'to_role',
        'upgraded_by',
        'school_id',
        'reason',
    ];

    protected function casts(): array
    {
        return [
            'from_role' => UserRole::class,
            'to_role' => UserRole::class,
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function upgradedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'upgraded_by');
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }
}
