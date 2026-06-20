<?php

namespace App\Http\Controllers\CbtAdmin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\CbtAdmin\StoreExamOfficerRequest;
use App\Http\Requests\CbtAdmin\UpdateExamOfficerRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\UserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class ExamOfficerController extends Controller
{
    public function __construct(
        private readonly UserService $userService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $officers = QueryBuilder::for(User::class)
            ->where('role', UserRole::ExamOfficer->value)
            ->allowedFilters(
                AllowedFilter::exact('school_id'),
                AllowedFilter::exact('is_active'),
                AllowedFilter::callback('search', function ($query, $value) {
                    $query->where(function ($q) use ($value) {
                        $q->where('name', 'like', "%{$value}%")
                          ->orWhere('file_number', 'like', "%{$value}%")
                          ->orWhere('email', 'like', "%{$value}%");
                    });
                }),
            )
            ->allowedSorts('name', 'file_number', 'created_at', 'last_login_at')
            ->defaultSort('name')
            ->paginate((int) $request->integer('per_page', 25))
            ->appends($request->query());

        return UserResource::collection($officers)->response();
    }

    public function store(StoreExamOfficerRequest $request): JsonResponse
    {
        [$user, $tempPassword] = $this->userService->createExamOfficer(
            $request->validated(),
            $request->user(),
            $request->ip(),
        );

        return response()->json([
            'user'          => new UserResource($user),
            'temp_password' => $tempPassword,
        ], 201);
    }

    public function update(UpdateExamOfficerRequest $request, User $examOfficer): UserResource
    {
        abort_unless($examOfficer->role === UserRole::ExamOfficer, 404);

        $user = $this->userService->updateExamOfficer(
            $examOfficer,
            $request->validated(),
            $request->user(),
            $request->ip(),
        );

        return new UserResource($user);
    }

    public function resetPassword(Request $request, User $examOfficer): JsonResponse
    {
        abort_unless($examOfficer->role === UserRole::ExamOfficer, 404);

        $tempPassword = $this->userService->resetPassword($examOfficer, $request->user(), $request->ip());

        return response()->json([
            'message'       => 'Password reset successfully.',
            'temp_password' => $tempPassword,
        ]);
    }

    public function destroy(Request $request, User $examOfficer): JsonResponse
    {
        abort_unless($examOfficer->role === UserRole::ExamOfficer, 404);

        // Soft-disable rather than hard delete to preserve audit trails.
        $this->userService->updateExamOfficer(
            $examOfficer,
            ['name' => $examOfficer->name, 'email' => $examOfficer->email, 'is_active' => false],
            $request->user(),
            $request->ip(),
        );
        $examOfficer->tokens()->delete();

        return response()->json(['message' => 'Exam Officer account deactivated.']);
    }
}
