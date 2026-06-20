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
     * Create a Lecturer account scoped to a school.
     *
     * @return array{0: User, 1: string}
     */
    public function createLecturer(array $data, ?User $actor, ?string $ip = null): array
    {
        $tempPassword = $this->generateTempPassword();

        $user = User::create([
            'file_number'           => $data['file_number'],
            'name'                  => $data['name'],
            'email'                 => $data['email'] ?? null,
            'password'              => $tempPassword,
            'role'                  => UserRole::Lecturer,
            'school_id'             => $data['school_id'],
            'department_id'         => $data['department_id'] ?? null,
            'is_active'             => true,
            'force_password_change' => true,
        ]);

        $this->auditLog->log('lecturer_created', $actor, User::class, $user->id, newValues: [
            'file_number' => $user->file_number,
            'name'        => $user->name,
        ], ipAddress: $ip);

        return [$user, $tempPassword];
    }

    /**
     * Create a Department Exam Officer scoped to a department (and its school).
     *
     * @return array{0: User, 1: string}
     */
    public function createDepartmentOfficer(array $data, ?User $actor, ?string $ip = null): array
    {
        $tempPassword = $this->generateTempPassword();

        $user = User::create([
            'file_number'           => $data['file_number'],
            'name'                  => $data['name'],
            'email'                 => $data['email'] ?? null,
            'password'              => $tempPassword,
            'role'                  => UserRole::DepartmentExamOfficer,
            'school_id'             => $data['school_id'],
            'department_id'         => $data['department_id'],
            'is_active'             => true,
            'force_password_change' => true,
        ]);

        $this->auditLog->log('department_officer_created', $actor, User::class, $user->id, newValues: [
            'file_number'   => $user->file_number,
            'name'          => $user->name,
            'department_id' => $user->department_id,
        ], ipAddress: $ip);

        return [$user, $tempPassword];
    }

    /**
     * Create a School Exam Officer scoped to a school. Returns the user plus the
     * plain temp password so the caller can surface it once to the CBT Admin.
     * The department is optional (the CBT Admin may leave it pending).
     *
     * @return array{0: User, 1: string}
     */
    public function createExamOfficer(array $data, ?User $actor, ?string $ip = null): array
    {
        $tempPassword = $this->generateTempPassword();

        $user = User::create([
            'file_number'           => $data['file_number'],
            'name'                  => $data['name'],
            'email'                 => $data['email'] ?? null,
            'password'              => $tempPassword,
            'role'                  => UserRole::ExamOfficer,
            'school_id'             => $data['school_id'],
            'department_id'         => $data['department_id'] ?? null,
            'is_active'             => true,
            'force_password_change' => true,
        ]);

        $this->auditLog->log('exam_officer_created', $actor, User::class, $user->id, newValues: [
            'file_number' => $user->file_number,
            'name'        => $user->name,
            'school_id'   => $user->school_id,
        ], ipAddress: $ip);

        return [$user, $tempPassword];
    }

    /**
     * Update a School Exam Officer's profile / active status. The department may
     * be set/changed here (it is optional at creation time).
     */
    public function updateExamOfficer(User $user, array $data, ?User $actor, ?string $ip = null): User
    {
        $original = $user->only(['name', 'email', 'is_active', 'department_id']);

        $user->update([
            'name'          => $data['name'],
            'email'         => $data['email'] ?? null,
            'is_active'     => $data['is_active'],
            'department_id' => array_key_exists('department_id', $data) ? $data['department_id'] : $user->department_id,
        ]);

        $this->auditLog->log('exam_officer_updated', $actor, User::class, $user->id,
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
