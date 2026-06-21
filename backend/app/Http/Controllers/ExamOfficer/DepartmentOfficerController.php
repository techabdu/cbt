<?php

namespace App\Http\Controllers\ExamOfficer;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\ExamOfficer\PromoteToDepartmentOfficerRequest;
use App\Http\Requests\ExamOfficer\StoreDepartmentOfficerRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\RoleManagementService;
use App\Services\UserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class DepartmentOfficerController extends Controller
{
    public function __construct(
        private readonly UserService $userService,
        private readonly RoleManagementService $roleService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $schoolId = $request->attributes->get('school_id');

        $officers = QueryBuilder::for(User::class)
            ->where('school_id', $schoolId)
            ->where('role', UserRole::DepartmentExamOfficer->value)
            ->with('department')
            ->allowedFilters(
                AllowedFilter::exact('department_id'),
                AllowedFilter::exact('is_active'),
                AllowedFilter::callback('search', fn ($q, $v) => $q->where(
                    fn ($q) => $q->where('name', 'like', "%{$v}%")->orWhere('file_number', 'like', "%{$v}%")
                ))
            )
            ->allowedSorts('name', 'file_number', 'created_at', 'last_login_at')
            ->defaultSort('name')
            ->paginate($request->integer('per_page', 25))
            ->withQueryString();

        return UserResource::collection($officers)->response();
    }

    /**
     * Lecturers in this school who can be promoted to Department Exam Officer.
     */
    public function eligible(Request $request): JsonResponse
    {
        $schoolId = $request->attributes->get('school_id');

        $lecturers = QueryBuilder::for(User::class)
            ->where('school_id', $schoolId)
            ->where('role', UserRole::Lecturer->value)
            ->where('is_active', true)
            ->with('department')
            ->allowedFilters(
                AllowedFilter::exact('department_id'),
                AllowedFilter::callback('search', fn ($q, $v) => $q->where(
                    fn ($q) => $q->where('name', 'like', "%{$v}%")->orWhere('file_number', 'like', "%{$v}%")
                ))
            )
            ->defaultSort('name')
            ->paginate($request->integer('per_page', 25))
            ->withQueryString();

        return UserResource::collection($lecturers)->response();
    }

    public function store(StoreDepartmentOfficerRequest $request): JsonResponse
    {
        $schoolId = $request->attributes->get('school_id');

        [$user, $tempPassword] = $this->userService->createDepartmentOfficer(
            array_merge($request->validated(), ['school_id' => $schoolId]),
            $request->user(),
            $request->ip()
        );

        return response()->json([
            'user'          => new UserResource($user->load('department')),
            'temp_password' => $tempPassword,
        ], 201);
    }

    public function promote(PromoteToDepartmentOfficerRequest $request, User $user): JsonResponse
    {
        $this->guardSameSchool($request, $user);

        $this->roleService->promoteToDepartmentOfficer(
            $user,
            (int) $request->validated('department_id'),
            $request->user(),
            $request->validated('reason'),
            $request->ip()
        );

        return (new UserResource($user->fresh()->load('department')))->response();
    }

    public function demote(Request $request, User $user): JsonResponse
    {
        $this->guardSameSchool($request, $user);

        $this->roleService->demoteFromDepartmentOfficer(
            $user, $request->user(), $request->input('reason'), $request->ip()
        );

        return (new UserResource($user->fresh()))->response();
    }

    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $this->guardSameSchool($request, $user);
        abort_unless($user->role === UserRole::DepartmentExamOfficer, 404);

        $tempPassword = $this->userService->resetPassword($user, $request->user(), $request->ip());

        return response()->json(['temp_password' => $tempPassword]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->guardSameSchool($request, $user);
        abort_unless($user->role === UserRole::DepartmentExamOfficer, 404);

        $user->update(['is_active' => false]);
        $user->tokens()->delete();

        return response()->json(null, 204);
    }

    private function guardSameSchool(Request $request, User $user): void
    {
        $schoolId = $request->attributes->get('school_id');
        if ($schoolId && $user->school_id !== (int) $schoolId) {
            abort(404);
        }
    }
}
