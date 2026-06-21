<?php

namespace App\Enums;

enum UserRole: string
{
    case SuperAdmin = 'super_admin';
    case CbtAdmin = 'cbt_admin';
    case ExamOfficer = 'exam_officer';
    case DepartmentExamOfficer = 'department_exam_officer';
    case Lecturer = 'lecturer';

    /**
     * Numeric rank used for hierarchy checks in the EnsureRole middleware.
     * A higher rank inherits the capabilities of every lower rank.
     */
    public function rank(): int
    {
        return match ($this) {
            self::SuperAdmin => 5,
            self::CbtAdmin => 4,
            self::ExamOfficer => 3,
            self::DepartmentExamOfficer => 2,
            self::Lecturer => 1,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::SuperAdmin => 'Super Admin',
            self::CbtAdmin => 'CBT Admin',
            self::ExamOfficer => 'School Exam Officer',
            self::DepartmentExamOfficer => 'Department Exam Officer',
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

    /**
     * Roles whose holders are lecturers (possibly with an officer privilege on
     * top) and can therefore be assigned to teach a course. Officers keep their
     * lecturer abilities, so they belong in the assignable pool too.
     *
     * @return array<int, string>
     */
    public static function teaching(): array
    {
        return [
            self::Lecturer->value,
            self::DepartmentExamOfficer->value,
            self::ExamOfficer->value,
        ];
    }
}
