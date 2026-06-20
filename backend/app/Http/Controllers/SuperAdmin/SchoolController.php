<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Http\Requests\SuperAdmin\StoreSchoolRequest;
use App\Http\Requests\SuperAdmin\UpdateSchoolRequest;
use App\Http\Resources\SchoolResource;
use App\Models\College;
use App\Models\School;
use App\Services\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class SchoolController extends Controller
{
    public function __construct(
        private readonly AuditLogService $auditLog,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $schools = QueryBuilder::for(School::class)
            ->withCount(['departments', 'students', 'users'])
            ->allowedFilters(
                AllowedFilter::callback('search', function ($query, $value) {
                    $query->where(function ($q) use ($value) {
                        $q->where('name', 'like', "%{$value}%")
                          ->orWhere('code', 'like', "%{$value}%");
                    });
                }),
            )
            ->allowedSorts('name', 'code', 'created_at')
            ->defaultSort('name')
            ->paginate((int) $request->integer('per_page', 25))
            ->appends($request->query());

        return SchoolResource::collection($schools)->response();
    }

    public function store(StoreSchoolRequest $request): JsonResponse
    {
        $college = College::query()->firstOrCreate([], ['name' => 'College of Education']);

        $school = School::create([
            'college_id' => $college->id,
            ...$request->validated(),
        ]);

        $this->auditLog->log('school_created', $request->user(), School::class, $school->id,
            newValues: $school->only(['name', 'code', 'head_name']),
            ipAddress: $request->ip(),
        );

        return (new SchoolResource($school))->response()->setStatusCode(201);
    }

    public function show(School $school): SchoolResource
    {
        $school->loadCount(['departments', 'students', 'users']);

        return new SchoolResource($school);
    }

    public function update(UpdateSchoolRequest $request, School $school): SchoolResource
    {
        $original = $school->only(['name', 'code', 'head_name']);

        $school->update($request->validated());

        $this->auditLog->log('school_updated', $request->user(), School::class, $school->id,
            oldValues: $original,
            newValues: $school->only(['name', 'code', 'head_name']),
            ipAddress: $request->ip(),
        );

        return new SchoolResource($school);
    }

    public function destroy(Request $request, School $school): JsonResponse
    {
        $school->loadCount(['users', 'students', 'departments']);

        if ($school->users_count > 0 || $school->students_count > 0 || $school->departments_count > 0) {
            return response()->json([
                'message' => 'This school still has departments, staff, or students attached. Reassign or remove them first.',
            ], 422);
        }

        $this->auditLog->log('school_deleted', $request->user(), School::class, $school->id,
            oldValues: $school->only(['name', 'code']),
            ipAddress: $request->ip(),
        );

        $school->delete();

        return response()->json(['message' => 'School deleted successfully.']);
    }
}
