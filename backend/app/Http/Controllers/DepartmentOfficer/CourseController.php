<?php

namespace App\Http\Controllers\DepartmentOfficer;

use App\Http\Controllers\Controller;
use App\Http\Requests\DepartmentOfficer\StoreCourseRequest;
use App\Http\Requests\DepartmentOfficer\UpdateCourseRequest;
use App\Http\Resources\CourseResource;
use App\Models\Course;
use App\Services\AuditLogService;
use App\Services\CombinationEnrollmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class CourseController extends Controller
{
    public function __construct(
        private readonly AuditLogService $auditLog,
        private readonly CombinationEnrollmentService $enrollment,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $deptId = $request->attributes->get('department_id');

        $courses = QueryBuilder::for(Course::class)
            ->where('department_id', $deptId)
            ->with('department')
            ->withCount(['lecturers', 'students'])
            ->allowedFilters(
                AllowedFilter::callback('search', fn ($q, $v) => $q->where(
                    fn ($q) => $q->where('title', 'like', "%{$v}%")
                               ->orWhere('code', 'like', "%{$v}%")
                )),
                AllowedFilter::exact('level'),
                AllowedFilter::exact('semester')
            )
            ->allowedSorts('title', 'code', 'level', 'semester', 'created_at')
            ->defaultSort('title')
            ->paginate($request->integer('per_page', 25))
            ->withQueryString();

        return CourseResource::collection($courses)->response();
    }

    public function store(StoreCourseRequest $request): JsonResponse
    {
        $schoolId = $request->attributes->get('school_id');

        $course = Course::create(array_merge($request->validated(), ['school_id' => $schoolId]));

        $this->auditLog->log(
            'course_created', $request->user(),
            Course::class, $course->id,
            newValues: ['title' => $course->title, 'code' => $course->code],
            ipAddress: $request->ip()
        );

        // Back-fill enrolments for students already assigned to a combination
        // that includes this department at the course's level.
        if ($session = $this->enrollment->currentSession((int) $schoolId)) {
            $this->enrollment->enrolStudentsForCourse($course, $session);
        }

        $course->load('department')->loadCount(['lecturers', 'students']);

        return (new CourseResource($course))->response()->setStatusCode(201);
    }

    public function show(Request $request, Course $course): JsonResponse
    {
        $this->guard($request, $course);
        $course->load('department')->loadCount(['lecturers', 'students']);

        return (new CourseResource($course))->response();
    }

    public function update(UpdateCourseRequest $request, Course $course): JsonResponse
    {
        $this->guard($request, $course);

        $old = $course->toArray();
        $course->update($request->validated());

        $this->auditLog->log(
            'course_updated', $request->user(),
            Course::class, $course->id,
            oldValues: $old, newValues: $course->fresh()->toArray(), ipAddress: $request->ip()
        );

        $course->refresh()->load('department')->loadCount(['lecturers', 'students']);

        return (new CourseResource($course))->response();
    }

    public function destroy(Request $request, Course $course): JsonResponse
    {
        $this->guard($request, $course);
        $course->loadCount(['lecturers', 'students']);

        if ($course->lecturers_count > 0 || $course->students_count > 0) {
            return response()->json([
                'message' => 'Cannot delete a course that still has assigned lecturers or enrolled students. Remove assignments first.',
            ], 422);
        }

        $this->auditLog->log(
            'course_deleted', $request->user(),
            Course::class, $course->id,
            oldValues: ['title' => $course->title, 'code' => $course->code],
            ipAddress: $request->ip()
        );

        $course->delete();

        return response()->json(null, 204);
    }

    private function guard(Request $request, Course $course): void
    {
        $schoolId = $request->attributes->get('school_id');
        $deptId   = $request->attributes->get('department_id');

        if (($schoolId && $course->school_id !== (int) $schoolId)
            || ($deptId && $course->department_id !== (int) $deptId)) {
            abort(403, 'Access denied.');
        }
    }
}
