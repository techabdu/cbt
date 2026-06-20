<?php

namespace App\Http\Controllers\CbtAdmin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\CbtAdmin\ChangeRoleRequest;
use App\Http\Resources\RoleUpgradeResource;
use App\Http\Resources\UserResource;
use App\Models\RoleUpgrade;
use App\Models\User;
use App\Services\RoleManagementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class RoleManagementController extends Controller
{
    public function __construct(private readonly RoleManagementService $service) {}

    /**
     * Users eligible for role changes: lecturers (promotable) and exam officers
     * (demotable). CBT and Super Admins are never listed here.
     */
    public function index(Request $request): JsonResponse
    {
        $users = QueryBuilder::for(User::class)
            ->whereIn('role', [UserRole::Lecturer->value, UserRole::ExamOfficer->value])
            ->with('school')
            ->allowedFilters(
                AllowedFilter::exact('role'),
                AllowedFilter::exact('school_id'),
                AllowedFilter::callback('search', fn ($q, $v) => $q->where(
                    fn ($q) => $q->where('name', 'like', "%{$v}%")->orWhere('file_number', 'like', "%{$v}%"))
                )
            )
            ->allowedSorts('name', 'role')
            ->defaultSort('name')
            ->paginate($request->integer('per_page', 25))
            ->withQueryString();

        return UserResource::collection($users)->response();
    }

    public function promote(ChangeRoleRequest $request, User $user): JsonResponse
    {
        $this->service->promote($user, $request->user(), $request->validated('reason'), $request->ip());

        return (new UserResource($user->fresh()))->response();
    }

    public function demote(ChangeRoleRequest $request, User $user): JsonResponse
    {
        $this->service->demote($user, $request->user(), $request->validated('reason'), $request->ip());

        return (new UserResource($user->fresh()))->response();
    }

    /**
     * Chronological history of role changes.
     */
    public function history(Request $request): JsonResponse
    {
        $history = QueryBuilder::for(RoleUpgrade::class)
            ->with(['user', 'upgradedBy'])
            ->allowedFilters(AllowedFilter::exact('user_id'))
            ->defaultSort('-created_at')
            ->paginate($request->integer('per_page', 25))
            ->withQueryString();

        return RoleUpgradeResource::collection($history)->response();
    }
}
