<?php

namespace App\Http\Controllers\DepartmentOfficer;

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
     * Read-only roster of students whose combination includes this department.
     * Students are registered and assigned to combinations by the School Exam
     * Officer; the department officer only views them.
     */
    public function index(Request $request): JsonResponse
    {
        $schoolId = $request->attributes->get('school_id');
        $deptId   = $request->attributes->get('department_id');

        $students = QueryBuilder::for(Student::class)
            ->where('school_id', $schoolId)
            ->whereHas('combination.departments', fn ($q) => $q->where('departments.id', $deptId))
            ->with('combination')
            ->allowedFilters(
                AllowedFilter::callback('search', fn ($q, $v) => $q->where(
                    fn ($q) => $q->where('full_name', 'like', "%{$v}%")
                               ->orWhere('matric_number', 'like', "%{$v}%")
                )),
                AllowedFilter::exact('combination_id'),
                AllowedFilter::exact('level'),
                AllowedFilter::exact('is_active')
            )
            ->allowedSorts('full_name', 'matric_number', 'level', 'created_at')
            ->defaultSort('full_name')
            ->paginate($request->integer('per_page', 25))
            ->withQueryString();

        return StudentResource::collection($students)->response();
    }
}
