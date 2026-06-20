<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Http\Requests\SuperAdmin\UpdateCollegeRequest;
use App\Http\Resources\CollegeResource;
use App\Models\College;
use App\Services\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CollegeController extends Controller
{
    public function __construct(
        private readonly AuditLogService $auditLog,
    ) {}

    /**
     * Return the single college record (created on demand if missing).
     */
    public function show(): JsonResponse
    {
        return (new CollegeResource($this->college()))->response()->setStatusCode(200);
    }

    public function update(UpdateCollegeRequest $request): JsonResponse
    {
        $college = $this->college();
        $original = $college->only(['name', 'contact_email', 'contact_phone', 'address']);

        $college->update($request->validated());

        $this->auditLog->log('college_updated', $request->user(), College::class, $college->id,
            oldValues: $original,
            newValues: $college->only(['name', 'contact_email', 'contact_phone', 'address']),
            ipAddress: $request->ip(),
        );

        return (new CollegeResource($college))->response()->setStatusCode(200);
    }

    private function college(): College
    {
        return College::query()->firstOrCreate([], ['name' => 'College of Education']);
    }
}
