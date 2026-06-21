<?php

namespace App\Http\Controllers\DepartmentOfficer;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\DepartmentOfficer\StoreLecturerRequest;
use App\Http\Requests\DepartmentOfficer\UpdateLecturerRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\UserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class LecturerController extends Controller
{
    public function __construct(
        private readonly UserService $userService,
        private readonly AuditLogService $auditLog,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $schoolId = $request->attributes->get('school_id');
        $deptId   = $request->attributes->get('department_id');

        $lecturers = QueryBuilder::for(User::class)
            ->where('school_id', $schoolId)
            ->where('department_id', $deptId)
            ->where('role', UserRole::Lecturer->value)
            ->allowedFilters(
                AllowedFilter::callback('search', fn ($q, $v) => $q->where(
                    fn ($q) => $q->where('name', 'like', "%{$v}%")
                               ->orWhere('file_number', 'like', "%{$v}%")
                               ->orWhere('email', 'like', "%{$v}%")
                ))
            )
            ->allowedSorts('name', 'file_number', 'created_at', 'last_login_at')
            ->defaultSort('name')
            ->paginate($request->integer('per_page', 25))
            ->withQueryString();

        return UserResource::collection($lecturers)->response();
    }

    /**
     * The pool of staff assignable to this department's courses: its lecturers
     * plus any officer (department or school) attached to the department, since
     * officers are lecturers-with-privilege and can teach too.
     */
    public function assignable(Request $request): JsonResponse
    {
        $schoolId = $request->attributes->get('school_id');
        $deptId   = $request->attributes->get('department_id');

        $staff = QueryBuilder::for(User::class)
            ->where('school_id', $schoolId)
            ->where('department_id', $deptId)
            ->whereIn('role', UserRole::teaching())
            ->where('is_active', true)
            ->allowedFilters(
                AllowedFilter::callback('search', fn ($q, $v) => $q->where(
                    fn ($q) => $q->where('name', 'like', "%{$v}%")
                               ->orWhere('file_number', 'like', "%{$v}%")
                ))
            )
            ->defaultSort('name')
            ->paginate($request->integer('per_page', 100))
            ->withQueryString();

        return UserResource::collection($staff)->response();
    }

    public function store(StoreLecturerRequest $request): JsonResponse
    {
        $schoolId = $request->attributes->get('school_id');
        $deptId   = $request->attributes->get('department_id');

        [$user, $tempPassword] = $this->userService->createLecturer(
            array_merge($request->validated(), ['school_id' => $schoolId, 'department_id' => $deptId]),
            $request->user(),
            $request->ip()
        );

        return response()->json(['user' => new UserResource($user), 'temp_password' => $tempPassword], 201);
    }

    public function update(UpdateLecturerRequest $request, User $lecturer): JsonResponse
    {
        $this->guard($request, $lecturer);

        $old = $lecturer->only(['name', 'email', 'is_active']);
        $lecturer->update($request->validated());

        $this->auditLog->log(
            'lecturer_updated', $request->user(),
            User::class, $lecturer->id,
            oldValues: $old, newValues: $lecturer->fresh()->only(['name', 'email', 'is_active']),
            ipAddress: $request->ip()
        );

        return (new UserResource($lecturer->fresh()))->response();
    }

    public function destroy(Request $request, User $lecturer): JsonResponse
    {
        $this->guard($request, $lecturer);

        $lecturer->update(['is_active' => false]);
        $lecturer->tokens()->delete();

        $this->auditLog->log(
            'lecturer_deactivated', $request->user(),
            User::class, $lecturer->id, ipAddress: $request->ip()
        );

        return response()->json(null, 204);
    }

    public function resetPassword(Request $request, User $lecturer): JsonResponse
    {
        $this->guard($request, $lecturer);

        $tempPassword = $this->userService->resetPassword($lecturer, $request->user(), $request->ip());

        return response()->json(['temp_password' => $tempPassword]);
    }

    private function guard(Request $request, User $lecturer): void
    {
        $schoolId = $request->attributes->get('school_id');
        $deptId   = $request->attributes->get('department_id');

        if ($lecturer->role !== UserRole::Lecturer
            || ($schoolId && $lecturer->school_id !== (int) $schoolId)
            || ($deptId && $lecturer->department_id !== (int) $deptId)) {
            abort(404);
        }
    }
}
