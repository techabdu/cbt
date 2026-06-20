<?php

namespace App\Http\Controllers\ExamOfficer;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\CourseResource;
use App\Http\Resources\UserResource;
use App\Models\Course;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class OversightController extends Controller
{
    /**
     * School-wide, read-only list of every course across all departments — the
     * School Exam Officer's supervision view. Day-to-day course management is
     * owned by each Department Exam Officer.
     */
    public function courses(Request $request): JsonResponse
    {
        $schoolId = $request->attributes->get('school_id');

        $courses = QueryBuilder::for(Course::class)
            ->where('school_id', $schoolId)
            ->with('department')
            ->withCount(['lecturers', 'students'])
            ->allowedFilters(
                AllowedFilter::callback('search', fn ($q, $v) => $q->where(
                    fn ($q) => $q->where('title', 'like', "%{$v}%")->orWhere('code', 'like', "%{$v}%")
                )),
                AllowedFilter::exact('department_id'),
                AllowedFilter::exact('level'),
                AllowedFilter::exact('semester')
            )
            ->allowedSorts('title', 'code', 'level', 'semester', 'created_at')
            ->defaultSort('title')
            ->paginate($request->integer('per_page', 25))
            ->withQueryString();

        return CourseResource::collection($courses)->response();
    }

    /**
     * School-wide, read-only list of every lecturer across all departments.
     */
    public function lecturers(Request $request): JsonResponse
    {
        $schoolId = $request->attributes->get('school_id');

        $lecturers = QueryBuilder::for(User::class)
            ->where('school_id', $schoolId)
            ->where('role', UserRole::Lecturer->value)
            ->with('department')
            ->allowedFilters(
                AllowedFilter::callback('search', fn ($q, $v) => $q->where(
                    fn ($q) => $q->where('name', 'like', "%{$v}%")->orWhere('file_number', 'like', "%{$v}%")
                )),
                AllowedFilter::exact('department_id')
            )
            ->allowedSorts('name', 'file_number', 'created_at', 'last_login_at')
            ->defaultSort('name')
            ->paginate($request->integer('per_page', 25))
            ->withQueryString();

        return UserResource::collection($lecturers)->response();
    }
}
