<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\SuperAdmin\StoreCbtAdminRequest;
use App\Http\Requests\SuperAdmin\UpdateCbtAdminRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\UserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class CbtAdminController extends Controller
{
    public function __construct(
        private readonly UserService $userService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $admins = QueryBuilder::for(User::class)
            ->where('role', UserRole::CbtAdmin->value)
            ->allowedFilters(
                AllowedFilter::callback('search', function ($query, $value) {
                    $query->where(function ($q) use ($value) {
                        $q->where('name', 'like', "%{$value}%")
                          ->orWhere('file_number', 'like', "%{$value}%")
                          ->orWhere('email', 'like', "%{$value}%");
                    });
                }),
                AllowedFilter::exact('is_active'),
            )
            ->allowedSorts('name', 'file_number', 'created_at', 'last_login_at')
            ->defaultSort('name')
            ->paginate((int) $request->integer('per_page', 25))
            ->appends($request->query());

        return UserResource::collection($admins)->response();
    }

    public function store(StoreCbtAdminRequest $request): JsonResponse
    {
        [$user, $tempPassword] = $this->userService->createCbtAdmin(
            $request->validated(),
            $request->user(),
            $request->ip(),
        );

        return response()->json([
            'user'          => new UserResource($user),
            'temp_password' => $tempPassword,
        ], 201);
    }

    public function update(UpdateCbtAdminRequest $request, User $cbtAdmin): UserResource
    {
        abort_unless($cbtAdmin->role === UserRole::CbtAdmin, 404);

        $user = $this->userService->updateCbtAdmin(
            $cbtAdmin,
            $request->validated(),
            $request->user(),
            $request->ip(),
        );

        return new UserResource($user);
    }

    public function resetPassword(Request $request, User $cbtAdmin): JsonResponse
    {
        abort_unless($cbtAdmin->role === UserRole::CbtAdmin, 404);

        $tempPassword = $this->userService->resetPassword($cbtAdmin, $request->user(), $request->ip());

        return response()->json([
            'message'       => 'Password reset successfully.',
            'temp_password' => $tempPassword,
        ]);
    }

    public function destroy(Request $request, User $cbtAdmin): JsonResponse
    {
        abort_unless($cbtAdmin->role === UserRole::CbtAdmin, 404);

        // Soft-disable rather than hard delete to preserve audit trails.
        $this->userService->updateCbtAdmin(
            $cbtAdmin,
            ['name' => $cbtAdmin->name, 'email' => $cbtAdmin->email, 'is_active' => false],
            $request->user(),
            $request->ip(),
        );
        $cbtAdmin->tokens()->delete();

        return response()->json(['message' => 'CBT Admin account deactivated.']);
    }
}
