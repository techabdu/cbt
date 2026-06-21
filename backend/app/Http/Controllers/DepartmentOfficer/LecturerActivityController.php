<?php

namespace App\Http\Controllers\DepartmentOfficer;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\CourseResource;
use App\Http\Resources\QuestionBankResource;
use App\Http\Resources\UserResource;
use App\Models\Course;
use App\Models\QuestionBank;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class LecturerActivityController extends Controller
{
    /**
     * Department lecturers with activity counts — the read-only oversight view.
     */
    public function index(Request $request): JsonResponse
    {
        $schoolId = $request->attributes->get('school_id');
        $deptId   = $request->attributes->get('department_id');

        $lecturers = QueryBuilder::for(User::class)
            ->where('school_id', $schoolId)
            ->where('department_id', $deptId)
            ->where('role', UserRole::Lecturer->value)
            ->withCount([
                'lecturerCourses as courses_count',
                'questionBanks as question_banks_count',
                'questionBanks as approved_banks_count' => fn ($q) => $q->where('status', 'approved'),
            ])
            ->allowedFilters(
                AllowedFilter::callback('search', fn ($q, $v) => $q->where(
                    fn ($q) => $q->where('name', 'like', "%{$v}%")
                               ->orWhere('file_number', 'like', "%{$v}%")
                ))
            )
            ->allowedSorts('name', 'file_number')
            ->defaultSort('name')
            ->paginate($request->integer('per_page', 25))
            ->withQueryString();

        return UserResource::collection($lecturers)->response();
    }

    public function questionBanks(Request $request, User $lecturer): JsonResponse
    {
        $this->guardLecturer($request, $lecturer);

        $banks = QueryBuilder::for(QuestionBank::class)
            ->where('lecturer_id', $lecturer->id)
            ->with('course.department')
            ->allowedFilters(AllowedFilter::exact('status'), AllowedFilter::exact('course_id'))
            ->allowedSorts('created_at', 'updated_at', 'status', 'total_questions')
            ->defaultSort('-updated_at')
            ->paginate($request->integer('per_page', 25))
            ->withQueryString();

        return QuestionBankResource::collection($banks)->response();
    }

    public function courses(Request $request, User $lecturer): JsonResponse
    {
        $this->guardLecturer($request, $lecturer);

        $courses = Course::query()
            ->with('department')
            ->whereHas('lecturers', fn ($q) => $q->where('lecturer_id', $lecturer->id))
            ->withCount('students')
            ->orderBy('title')
            ->get();

        return CourseResource::collection($courses)->response();
    }

    private function guardLecturer(Request $request, User $lecturer): void
    {
        $schoolId = $request->attributes->get('school_id');
        $deptId   = $request->attributes->get('department_id');

        if ($lecturer->role !== UserRole::Lecturer
            || ($schoolId && $lecturer->school_id !== (int) $schoolId)
            || ($deptId && $lecturer->department_id !== (int) $deptId)) {
            abort(404);
        }
    }
}
