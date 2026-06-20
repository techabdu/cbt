<?php

namespace App\Http\Controllers\CbtAdmin;

use App\Http\Controllers\Controller;
use App\Http\Resources\SchoolResource;
use App\Models\School;
use Illuminate\Http\JsonResponse;

class SchoolController extends Controller
{
    /**
     * Read-only list of every school, used to populate the "assign to school"
     * selector when a CBT Admin creates an Exam Officer. Schools themselves are
     * created and managed by the Super Admin.
     */
    public function index(): JsonResponse
    {
        $schools = School::query()->orderBy('name')->get();

        return SchoolResource::collection($schools)->response();
    }
}
