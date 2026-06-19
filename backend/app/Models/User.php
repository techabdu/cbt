<?php

namespace App\Models;

use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'file_number',
        'name',
        'email',
        'password',
        'role',
        'school_id',
        'is_active',
        'force_password_change',
        'last_login_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'is_active' => 'boolean',
            'force_password_change' => 'boolean',
            'last_login_at' => 'datetime',
        ];
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function lecturerCourses(): HasMany
    {
        return $this->hasMany(LecturerCourse::class, 'lecturer_id');
    }

    public function questionBanks(): HasMany
    {
        return $this->hasMany(QuestionBank::class, 'lecturer_id');
    }

    public function hasRole(UserRole $role): bool
    {
        return $this->role === $role;
    }

    /**
     * Whether this user's role meets or exceeds the given role in the hierarchy.
     */
    public function hasAtLeastRole(UserRole $role): bool
    {
        return $this->role->satisfies($role);
    }
}
