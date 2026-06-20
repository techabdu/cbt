<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Models\RoleUpgrade;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class RoleManagementService
{
    public function __construct(
        private readonly AuditLogService $auditLog,
    ) {}

    /**
     * Promote a Lecturer to School Exam Officer. The user keeps their school.
     */
    public function promote(User $user, User $actor, ?string $reason = null, ?string $ip = null): User
    {
        if ($user->role !== UserRole::Lecturer) {
            throw ValidationException::withMessages([
                'role' => 'Only a lecturer can be promoted to Exam Officer.',
            ]);
        }

        if (! $user->school_id) {
            throw ValidationException::withMessages([
                'role' => 'This user is not attached to a school and cannot be an Exam Officer.',
            ]);
        }

        return $this->applyChange($user, UserRole::ExamOfficer, $actor, $reason, $ip);
    }

    /**
     * Demote a School Exam Officer back to Lecturer.
     */
    public function demote(User $user, User $actor, ?string $reason = null, ?string $ip = null): User
    {
        if ($user->role !== UserRole::ExamOfficer) {
            throw ValidationException::withMessages([
                'role' => 'Only an Exam Officer can be demoted to Lecturer.',
            ]);
        }

        return $this->applyChange($user, UserRole::Lecturer, $actor, $reason, $ip);
    }

    private function applyChange(User $user, UserRole $toRole, User $actor, ?string $reason, ?string $ip): User
    {
        $fromRole = $user->role;

        RoleUpgrade::create([
            'user_id'     => $user->id,
            'from_role'   => $fromRole,
            'to_role'     => $toRole,
            'upgraded_by' => $actor->id,
            'school_id'   => $user->school_id,
            'reason'      => $reason,
        ]);

        $user->update(['role' => $toRole]);

        // A role change alters their capabilities; revoke sessions so the new
        // role is reflected on their next login.
        $user->tokens()->delete();

        $this->auditLog->log('role_changed', $actor, User::class, $user->id,
            oldValues: ['role' => $fromRole->value],
            newValues: ['role' => $toRole->value, 'reason' => $reason],
            ipAddress: $ip);

        return $user;
    }
}
