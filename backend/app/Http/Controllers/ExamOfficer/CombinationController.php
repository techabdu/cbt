<?php

namespace App\Http\Controllers\ExamOfficer;

use App\Http\Controllers\Controller;
use App\Http\Requests\ExamOfficer\StoreCombinationRequest;
use App\Http\Requests\ExamOfficer\UpdateCombinationRequest;
use App\Http\Resources\CombinationResource;
use App\Models\Combination;
use App\Services\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class CombinationController extends Controller
{
    public function __construct(private readonly AuditLogService $auditLog) {}

    public function index(Request $request): JsonResponse
    {
        $schoolId = $request->attributes->get('school_id');

        $combinations = QueryBuilder::for(Combination::class)
            ->where('school_id', $schoolId)
            ->with('departments')
            ->withCount('students')
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

        return CombinationResource::collection($combinations)->response();
    }

    public function store(StoreCombinationRequest $request): JsonResponse
    {
        $schoolId = $request->attributes->get('school_id');

        $combination = Combination::create([
            'school_id' => $schoolId,
            'name'      => $request->validated('name'),
            'code'      => $request->validated('code'),
        ]);
        $combination->departments()->sync($request->validated('department_ids'));

        $this->auditLog->log(
            'combination_created', $request->user(),
            Combination::class, $combination->id,
            newValues: ['name' => $combination->name, 'code' => $combination->code],
            ipAddress: $request->ip()
        );

        $combination->load('departments')->loadCount('students');

        return (new CombinationResource($combination))->response()->setStatusCode(201);
    }

    public function show(Request $request, Combination $combination): JsonResponse
    {
        $this->guard($request, $combination->school_id);
        $combination->load('departments')->loadCount('students');

        return (new CombinationResource($combination))->response();
    }

    public function update(UpdateCombinationRequest $request, Combination $combination): JsonResponse
    {
        $this->guard($request, $combination->school_id);

        $old = $combination->toArray();
        $combination->update([
            'name' => $request->validated('name'),
            'code' => $request->validated('code'),
        ]);
        $combination->departments()->sync($request->validated('department_ids'));

        $this->auditLog->log(
            'combination_updated', $request->user(),
            Combination::class, $combination->id,
            oldValues: $old, newValues: $combination->fresh()->toArray(), ipAddress: $request->ip()
        );

        $combination->refresh()->load('departments')->loadCount('students');

        return (new CombinationResource($combination))->response();
    }

    public function destroy(Request $request, Combination $combination): JsonResponse
    {
        $this->guard($request, $combination->school_id);
        $combination->loadCount('students');

        if ($combination->students_count > 0) {
            return response()->json([
                'message' => 'Cannot delete a combination that still has students assigned. Reassign them first.',
            ], 422);
        }

        $this->auditLog->log(
            'combination_deleted', $request->user(),
            Combination::class, $combination->id,
            oldValues: ['name' => $combination->name, 'code' => $combination->code],
            ipAddress: $request->ip()
        );

        $combination->delete();

        return response()->json(null, 204);
    }

    private function guard(Request $request, int $combinationSchoolId): void
    {
        $schoolId = $request->attributes->get('school_id');
        if ($schoolId && $combinationSchoolId !== (int) $schoolId) {
            abort(403, 'Access denied.');
        }
    }
}
