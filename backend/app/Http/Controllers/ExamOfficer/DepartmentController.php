<?php

namespace App\Http\Controllers\ExamOfficer;

use App\Http\Controllers\Controller;
use App\Http\Requests\ExamOfficer\StoreDepartmentRequest;
use App\Http\Requests\ExamOfficer\UpdateDepartmentRequest;
use App\Http\Resources\DepartmentResource;
use App\Models\Department;
use App\Services\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class DepartmentController extends Controller
{
    public function __construct(private readonly AuditLogService $auditLog) {}

    public function index(Request $request): JsonResponse
    {
        $schoolId = $request->attributes->get('school_id');

        $departments = QueryBuilder::for(Department::class)
            ->where('school_id', $schoolId)
            ->withCount(['courses', 'students'])
            ->allowedFilters(
                AllowedFilter::callback('search', fn ($q, $v) => $q->where(
                    fn ($q) => $q->where('name', 'like', "%{$v}%")
                               ->orWhere('code', 'like', "%{$v}%")
                ))
            )
            ->allowedSorts('name', 'code', 'created_at')
            ->defaultSort('name')
            ->paginate($request->integer('per_page', 25))
            ->withQueryString();

        return DepartmentResource::collection($departments)->response();
    }

    public function store(StoreDepartmentRequest $request): JsonResponse
    {
        $schoolId   = $request->attributes->get('school_id');
        $department = Department::create(array_merge($request->validated(), ['school_id' => $schoolId]));

        $this->auditLog->log(
            'department_created', $request->user(),
            Department::class, $department->id,
            newValues: $department->toArray(), ipAddress: $request->ip()
        );

        $department->loadCount(['courses', 'students']);

        return (new DepartmentResource($department))->response()->setStatusCode(201);
    }

    public function show(Request $request, Department $department): JsonResponse
    {
        $this->guard($request, $department->school_id);
        $department->loadCount(['courses', 'students']);

        return (new DepartmentResource($department))->response();
    }

    public function update(UpdateDepartmentRequest $request, Department $department): JsonResponse
    {
        $this->guard($request, $department->school_id);

        $old = $department->toArray();
        $department->update($request->validated());

        $this->auditLog->log(
            'department_updated', $request->user(),
            Department::class, $department->id,
            oldValues: $old, newValues: $department->fresh()->toArray(), ipAddress: $request->ip()
        );

        $department->refresh()->loadCount(['courses', 'students']);

        return (new DepartmentResource($department))->response();
    }

    public function destroy(Request $request, Department $department): JsonResponse
    {
        $this->guard($request, $department->school_id);
        $department->loadCount(['courses', 'students']);

        if ($department->courses_count > 0 || $department->students_count > 0) {
            return response()->json([
                'message' => 'Cannot delete a department that still has courses or students. Remove them first.',
            ], 422);
        }

        $this->auditLog->log(
            'department_deleted', $request->user(),
            Department::class, $department->id,
            oldValues: $department->toArray(), ipAddress: $request->ip()
        );

        $department->delete();

        return response()->json(null, 204);
    }

    private function guard(Request $request, int $deptSchoolId): void
    {
        $schoolId = $request->attributes->get('school_id');
        if ($schoolId && $deptSchoolId !== (int) $schoolId) {
            abort(403, 'Access denied.');
        }
    }
}
