<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthService
{
    public function __construct(
        private readonly AuditLogService $auditLog,
    ) {}

    /**
     * Validate credentials and return a Sanctum token + user.
     *
     * @throws ValidationException if credentials are wrong or account is inactive.
     */
    public function login(string $fileNumber, string $password, string $ipAddress): array
    {
        $user = User::where('file_number', $fileNumber)->first();

        if (! $user || ! Hash::check($password, $user->password)) {
            throw ValidationException::withMessages([
                'file_number' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'file_number' => ['Your account has been deactivated. Contact an administrator.'],
            ]);
        }

        $user->update(['last_login_at' => now()]);

        $this->auditLog->log('login', $user, User::class, $user->id, ipAddress: $ipAddress);

        $token = $user->createToken('api-token', ['*'], now()->addMinutes(config('sanctum.expiration', 480)))->plainTextToken;

        return [$token, $user];
    }

    /**
     * Revoke the current access token.
     */
    public function logout(User $user): void
    {
        $user->currentAccessToken()->delete();

        $this->auditLog->log('logout', $user, User::class, $user->id);
    }

    /**
     * Change the authenticated user's password.
     *
     * @throws ValidationException if current password is wrong.
     */
    public function changePassword(User $user, string $currentPassword, string $newPassword, string $ipAddress): void
    {
        if (! Hash::check($currentPassword, $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }

        $user->update([
            'password'              => $newPassword,
            'force_password_change' => false,
        ]);

        $this->auditLog->log('password_changed', $user, User::class, $user->id, ipAddress: $ipAddress);
    }
}
