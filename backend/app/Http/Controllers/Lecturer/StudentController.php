<?php

namespace App\Http\Controllers\Lecturer;

use App\Http\Controllers\Controller;
use App\Http\Resources\StudentResource;
use App\Models\Student;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class StudentController extends Controller
{
    /**
     * Read-only roster of students enrolled in courses the authenticated
     * lecturer is assigned to. Optionally narrowed to a single such course.
     */
    public function index(Request $request): JsonResponse
    {
        $lecturer  = $request->user();
        $courseIds = $lecturer->lecturerCourses()->pluck('course_id');

        $students = QueryBuilder::for(Student::class)
            ->whereHas('courses', fn ($q) => $q->whereIn('courses.id', $courseIds))
            ->with('combination')
            ->allowedFilters(
                AllowedFilter::callback('search', fn ($q, $v) => $q->where(
                    fn ($q) => $q->where('full_name', 'like', "%{$v}%")
                               ->orWhere('matric_number', 'like', "%{$v}%")
                )),
                AllowedFilter::exact('level'),
                AllowedFilter::callback('course_id', fn ($q, $v) => $q->whereHas(
                    'courses', fn ($c) => $c->where('courses.id', $v)->whereIn('courses.id', $courseIds)
                )),
            )
            ->allowedSorts('full_name', 'matric_number', 'level')
            ->defaultSort('full_name')
            ->paginate($request->integer('per_page', 25))
            ->withQueryString();

        return StudentResource::collection($students)->response();
    }
}
