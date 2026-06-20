<?php

namespace App\Services;

use App\Models\AcademicSession;
use App\Models\Combination;
use App\Models\Course;
use App\Models\Student;
use App\Models\StudentCourse;

class CombinationEnrollmentService
{
    /**
     * The school's current academic session string (e.g. "2024/2025"), or null
     * if the academic calendar has not been set yet.
     */
    public function currentSession(int $schoolId): ?string
    {
        return AcademicSession::where('school_id', $schoolId)
            ->where('is_current', true)
            ->value('session');
    }

    /**
     * Enrol the given students into every course offered by the combination's
     * departments at each student's level, for the supplied session. One pivot
     * row is written per course using the course's own semester. Idempotent.
     *
     * @param  int[]  $studentIds
     * @return int  number of (student, course) enrolments created
     */
    public function enrolStudents(Combination $combination, array $studentIds, string $session): int
    {
        $departmentIds = $combination->departments()->pluck('departments.id');

        $students = Student::whereIn('id', $studentIds)
            ->where('combination_id', $combination->id)
            ->get();

        $created = 0;

        foreach ($students as $student) {
            $courses = Course::whereIn('department_id', $departmentIds)
                ->where('level', $student->level->value)
                ->get();

            foreach ($courses as $course) {
                $created += $this->enrol($student->id, $course, $session);
            }
        }

        return $created;
    }

    /**
     * When a new course is created, enrol every already-assigned student whose
     * combination includes the course's department and whose level matches it.
     */
    public function enrolStudentsForCourse(Course $course, string $session): int
    {
        $students = Student::where('level', $course->level->value)
            ->whereHas('combination.departments', fn ($q) => $q->where('departments.id', $course->department_id))
            ->get();

        $created = 0;

        foreach ($students as $student) {
            $created += $this->enrol($student->id, $course, $session);
        }

        return $created;
    }

    private function enrol(int $studentId, Course $course, string $session): int
    {
        $row = StudentCourse::firstOrCreate([
            'student_id' => $studentId,
            'course_id'  => $course->id,
            'session'    => $session,
            'semester'   => $course->semester->value,
        ]);

        return $row->wasRecentlyCreated ? 1 : 0;
    }
}
