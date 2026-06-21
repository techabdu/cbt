<?php

namespace App\Http\Controllers\CbtAdmin;

use App\Http\Controllers\Controller;
use App\Http\Resources\DepartmentResource;
use App\Models\Department;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{
    /**
     * Read-only list of a school's departments, used to populate the optional
     * "attach to department" selector when a CBT Admin creates/edits an Exam
     * Officer. The school is taken from the `school_id` query filter.
     */
    public function index(Request $request): JsonResponse
    {
        $departments = Department::query()
            ->when($request->filled('school_id'), fn ($q) => $q->where('school_id', $request->integer('school_id')))
            ->orderBy('name')
            ->get();

        return DepartmentResource::collection($departments)->response();
    }
}
