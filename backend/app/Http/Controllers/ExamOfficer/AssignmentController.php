<?php

namespace App\Http\Controllers\ExamOfficer;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\ExamOfficer\AssignLecturerRequest;
use App\Http\Requests\ExamOfficer\AssignStudentsRequest;
use App\Http\Resources\StudentResource;
use App\Http\Resources\UserResource;
use App\Models\Course;
use App\Models\Student;
use App\Models\User;
use App\Services\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssignmentController extends Controller
{
    public function __construct(private readonly AuditLogService $auditLog) {}

    // ── Lecturers ──────────────────────────────────────────────────────────────

    public function courseLecturers(Request $request, Course $course): JsonResponse
    {
        $this->guardCourse($request, $course);

        $lecturers = $course->lecturers()
            ->orderBy('name')
            ->get();

        return UserResource::collection($lecturers)->response();
    }

    public function assignLecturer(AssignLecturerRequest $request, Course $course): JsonResponse
    {
        $this->guardCourse($request, $course);

        $lecturerId = $request->validated('lecturer_id');
        $session    = $request->validated('session');
        $semester   = $request->validated('semester');

        // Idempotent — same lecturer can't be assigned twice for same session+semester
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

    // ── Students ───────────────────────────────────────────────────────────────

    public function courseStudents(Request $request, Course $course): JsonResponse
    {
        $this->guardCourse($request, $course);

        $students = $course->students()
            ->with('department')
            ->orderBy('full_name')
            ->paginate($request->integer('per_page', 50))
            ->withQueryString();

        return StudentResource::collection($students)->response();
    }

    public function assignStudents(AssignStudentsRequest $request, Course $course): JsonResponse
    {
        $this->guardCourse($request, $course);

        $ids      = $request->validated('student_ids');
        $session  = $request->validated('session');
        $semester = $request->validated('semester');

        $pivotData = array_fill_keys($ids, ['session' => $session, 'semester' => $semester]);
        $course->students()->syncWithoutDetaching($pivotData);

        $this->auditLog->log(
            'students_enrolled_in_course', $request->user(),
            Course::class, $course->id,
            newValues: ['student_ids' => $ids, 'count' => count($ids), 'session' => $session, 'semester' => $semester],
            ipAddress: $request->ip()
        );

        return response()->json(['message' => count($ids) . ' student(s) enrolled successfully.']);
    }

    public function removeStudent(Request $request, Course $course, Student $student): JsonResponse
    {
        $this->guardCourse($request, $course);

        $course->students()->detach($student->id);

        $this->auditLog->log(
            'student_removed_from_course', $request->user(),
            Course::class, $course->id,
            oldValues: ['student_id' => $student->id],
            ipAddress: $request->ip()
        );

        return response()->json(null, 204);
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private function guardCourse(Request $request, Course $course): void
    {
        $schoolId = $request->attributes->get('school_id');
        if ($schoolId && $course->school_id !== (int) $schoolId) {
            abort(403, 'Access denied.');
        }
    }
}
