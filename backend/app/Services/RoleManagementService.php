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
     * Promote a Lecturer or Department Exam Officer to School Exam Officer
     * (CBT-Admin tier). The user keeps their school.
     */
    public function promote(User $user, User $actor, ?string $reason = null, ?string $ip = null): User
    {
        if (! in_array($user->role, [UserRole::Lecturer, UserRole::DepartmentExamOfficer], true)) {
            throw ValidationException::withMessages([
                'role' => 'Only a Lecturer or Department Exam Officer can be promoted to School Exam Officer.',
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
     * Demote a School Exam Officer (CBT-Admin tier). They step back to Department
     * Exam Officer if they retain a department, otherwise to Lecturer.
     */
    public function demote(User $user, User $actor, ?string $reason = null, ?string $ip = null): User
    {
        if ($user->role !== UserRole::ExamOfficer) {
            throw ValidationException::withMessages([
                'role' => 'Only an Exam Officer can be demoted here.',
            ]);
        }

        $target = $user->department_id ? UserRole::DepartmentExamOfficer : UserRole::Lecturer;

        return $this->applyChange($user, $target, $actor, $reason, $ip);
    }

    /**
     * Promote a Lecturer to Department Exam Officer of the given department
     * (School-Officer tier). The department is recorded on the user.
     */
    public function promoteToDepartmentOfficer(User $user, int $departmentId, User $actor, ?string $reason = null, ?string $ip = null): User
    {
        if ($user->role !== UserRole::Lecturer) {
            throw ValidationException::withMessages([
                'role' => 'Only a Lecturer can be promoted to Department Exam Officer.',
            ]);
        }

        if (! $user->school_id) {
            throw ValidationException::withMessages([
                'role' => 'This user is not attached to a school.',
            ]);
        }

        $user->update(['department_id' => $departmentId]);

        return $this->applyChange($user, UserRole::DepartmentExamOfficer, $actor, $reason, $ip);
    }

    /**
     * Demote a Department Exam Officer back to Lecturer (School-Officer tier).
     * They keep their department attachment.
     */
    public function demoteFromDepartmentOfficer(User $user, User $actor, ?string $reason = null, ?string $ip = null): User
    {
        if ($user->role !== UserRole::DepartmentExamOfficer) {
            throw ValidationException::withMessages([
                'role' => 'Only a Department Exam Officer can be demoted to Lecturer.',
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
