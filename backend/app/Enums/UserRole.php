<?php

namespace App\Enums;

enum UserRole: string
{
    case SuperAdmin = 'super_admin';
    case CbtAdmin = 'cbt_admin';
    case ExamOfficer = 'exam_officer';
    case Lecturer = 'lecturer';

    /**
     * Numeric rank used for hierarchy checks in the EnsureRole middleware.
     * A higher rank inherits the capabilities of every lower rank.
     */
    public function rank(): int
    {
        return match ($this) {
            self::SuperAdmin => 4,
            self::CbtAdmin => 3,
            self::ExamOfficer => 2,
            self::Lecturer => 1,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::SuperAdmin => 'Super Admin',
            self::CbtAdmin => 'CBT Admin',
            self::ExamOfficer => 'School Exam Officer',
            self::Lecturer => 'Lecturer',
        };
    }

    /**
     * Does this role satisfy the minimum required role?
     */
    public function satisfies(self $required): bool
    {
        return $this->rank() >= $required->rank();
    }
}
