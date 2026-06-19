<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Support\Str;

class UserService
{
    public function __construct(
        private readonly AuditLogService $auditLog,
    ) {}

    /**
     * Generate a human-friendly temporary password.
     */
    public function generateTempPassword(): string
    {
        // 10 chars, mixed — readable enough to dictate over the phone if needed.
        return Str::password(10, symbols: false);
    }

    /**
     * Create a CBT Admin account. Returns the user plus the plain temp password
     * so the caller can surface it once to the Super Admin.
     *
     * @return array{0: User, 1: string}
     */
    public function createCbtAdmin(array $data, ?User $actor, ?string $ip = null): array
    {
        $tempPassword = $this->generateTempPassword();

        $user = User::create([
            'file_number'           => $data['file_number'],
            'name'                  => $data['name'],
            'email'                 => $data['email'] ?? null,
            'password'              => $tempPassword,
            'role'                  => UserRole::CbtAdmin,
            'school_id'             => null,
            'is_active'             => true,
            'force_password_change' => true,
        ]);

        $this->auditLog->log('cbt_admin_created', $actor, User::class, $user->id, newValues: [
            'file_number' => $user->file_number,
            'name'        => $user->name,
        ], ipAddress: $ip);

        return [$user, $tempPassword];
    }

    /**
     * Update a CBT Admin's profile / active status.
     */
    public function updateCbtAdmin(User $user, array $data, ?User $actor, ?string $ip = null): User
    {
        $original = $user->only(['name', 'email', 'is_active']);

        $user->update([
            'name'      => $data['name'],
            'email'     => $data['email'] ?? null,
            'is_active' => $data['is_active'],
        ]);

        $this->auditLog->log('cbt_admin_updated', $actor, User::class, $user->id,
            oldValues: $original,
            newValues: $user->only(['name', 'email', 'is_active']),
            ipAddress: $ip,
        );

        return $user;
    }

    /**
     * Reset a user's password to a fresh temp password and force a change.
     *
     * @return string the plain temp password
     */
    public function resetPassword(User $user, ?User $actor, ?string $ip = null): string
    {
        $tempPassword = $this->generateTempPassword();

        $user->update([
            'password'              => $tempPassword,
            'force_password_change' => true,
        ]);

        // Revoke existing sessions so the old password can't be used post-reset.
        $user->tokens()->delete();

        $this->auditLog->log('password_reset', $actor, User::class, $user->id, ipAddress: $ip);

        return $tempPassword;
    }
}
