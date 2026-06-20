<?php

namespace App\Http\Controllers\ExamOfficer;

use App\Http\Controllers\Controller;
use App\Http\Requests\ExamOfficer\StoreStudentRequest;
use App\Http\Requests\ExamOfficer\UpdateStudentRequest;
use App\Http\Resources\StudentResource;
use App\Models\Student;
use App\Services\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class StudentController extends Controller
{
    public function __construct(private readonly AuditLogService $auditLog) {}

    public function index(Request $request): JsonResponse
    {
        $schoolId = $request->attributes->get('school_id');

        $students = QueryBuilder::for(Student::class)
            ->where('school_id', $schoolId)
            ->with(['department', 'combination'])
            ->allowedFilters(
                AllowedFilter::callback('search', fn ($q, $v) => $q->where(
                    fn ($q) => $q->where('full_name', 'like', "%{$v}%")
                               ->orWhere('matric_number', 'like', "%{$v}%")
                )),
                AllowedFilter::exact('department_id'),
                AllowedFilter::exact('combination_id'),
                AllowedFilter::exact('level'),
                AllowedFilter::exact('is_active')
            )
            ->allowedSorts('full_name', 'matric_number', 'level', 'created_at')
            ->defaultSort('full_name')
            ->paginate($request->integer('per_page', 25))
            ->withQueryString();

        return StudentResource::collection($students)->response();
    }

    public function store(StoreStudentRequest $request): JsonResponse
    {
        $schoolId = $request->attributes->get('school_id');

        $student = Student::create(array_merge($request->validated(), [
            'school_id' => $schoolId,
            'is_active' => true,
        ]));

        $this->auditLog->log(
            'student_created', $request->user(),
            Student::class, $student->id,
            newValues: ['matric_number' => $student->matric_number, 'full_name' => $student->full_name],
            ipAddress: $request->ip()
        );

        $student->load(['department', 'combination']);

        return (new StudentResource($student))->response()->setStatusCode(201);
    }

    public function show(Request $request, Student $student): JsonResponse
    {
        $this->guard($request, $student->school_id);
        $student->load(['department', 'combination']);

        return (new StudentResource($student))->response();
    }

    public function update(UpdateStudentRequest $request, Student $student): JsonResponse
    {
        $this->guard($request, $student->school_id);

        $old = $student->toArray();
        $student->update($request->validated());

        $this->auditLog->log(
            'student_updated', $request->user(),
            Student::class, $student->id,
            oldValues: $old, newValues: $student->fresh()->toArray(), ipAddress: $request->ip()
        );

        $student->refresh()->load(['department', 'combination']);

        return (new StudentResource($student))->response();
    }

    public function destroy(Request $request, Student $student): JsonResponse
    {
        $this->guard($request, $student->school_id);

        // Check if the student has exam results — preserve them
        if ($student->results()->exists()) {
            return response()->json([
                'message' => 'Cannot delete a student who has exam records. Deactivate them instead.',
            ], 422);
        }

        $this->auditLog->log(
            'student_deleted', $request->user(),
            Student::class, $student->id,
            oldValues: ['matric_number' => $student->matric_number, 'full_name' => $student->full_name],
            ipAddress: $request->ip()
        );

        $student->delete();

        return response()->json(null, 204);
    }

    private function guard(Request $request, int $studentSchoolId): void
    {
        $schoolId = $request->attributes->get('school_id');
        if ($schoolId && $studentSchoolId !== (int) $schoolId) {
            abort(403, 'Access denied.');
        }
    }
}
