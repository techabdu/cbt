<?php

namespace App\Http\Controllers\DepartmentOfficer;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\DepartmentOfficer\AssignLecturerRequest;
use App\Http\Resources\StudentResource;
use App\Http\Resources\UserResource;
use App\Models\Course;
use App\Models\User;
use App\Services\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssignmentController extends Controller
{
    public function __construct(private readonly AuditLogService $auditLog) {}

    public function courseLecturers(Request $request, Course $course): JsonResponse
    {
        $this->guardCourse($request, $course);

        return UserResource::collection($course->lecturers()->orderBy('name')->get())->response();
    }

    public function assignLecturer(AssignLecturerRequest $request, Course $course): JsonResponse
    {
        $this->guardCourse($request, $course);

        $lecturerId = $request->validated('lecturer_id');
        $session    = $request->validated('session');
        $semester   = $request->validated('semester');

        $course->lecturers()->syncWithoutDetaching([
            $lecturerId => ['session' => $session, 'semester' => $semester],
        ]);

        $this->auditLog->log(
            'lecturer_assigned_to_course', $request->user(),
            Course::class, $course->id,
            newValues: ['lecturer_id' => $lecturerId, 'session' => $session, 'semester' => $semester],
            ipAddress: $request->ip()
        );

        return response()->json(['message' => 'Lecturer assigned successfully.']);
    }

    public function removeLecturer(Request $request, Course $course, User $lecturer): JsonResponse
    {
        $this->guardCourse($request, $course);

        if ($lecturer->role !== UserRole::Lecturer) {
            abort(404);
        }

        $course->lecturers()->detach($lecturer->id);

        $this->auditLog->log(
            'lecturer_removed_from_course', $request->user(),
            Course::class, $course->id,
            oldValues: ['lecturer_id' => $lecturer->id],
            ipAddress: $request->ip()
        );

        return response()->json(null, 204);
    }

    /**
     * Read-only roster of students enrolled in a course (enrolment itself is
     * driven by combination assignment, owned by the School Exam Officer).
     */
    public function courseStudents(Request $request, Course $course): JsonResponse
    {
        $this->guardCourse($request, $course);

        $students = $course->students()
            ->with('combination')
            ->orderBy('full_name')
            ->paginate($request->integer('per_page', 50))
            ->withQueryString();

        return StudentResource::collection($students)->response();
    }

    private function guardCourse(Request $request, Course $course): void
    {
        $schoolId = $request->attributes->get('school_id');
        $deptId   = $request->attributes->get('department_id');

        if (($schoolId && $course->school_id !== (int) $schoolId)
            || ($deptId && $course->department_id !== (int) $deptId)) {
            abort(403, 'Access denied.');
        }
    }
}
