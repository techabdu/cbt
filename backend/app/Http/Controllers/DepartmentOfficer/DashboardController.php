<?php

namespace App\Http\Controllers\DepartmentOfficer;

use App\Enums\QuestionBankStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\QuestionBank;
use App\Models\Student;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function stats(Request $request): JsonResponse
    {
        $schoolId = $request->attributes->get('school_id');
        $deptId   = $request->attributes->get('department_id');

        return response()->json([
            'lecturers'          => User::where('school_id', $schoolId)
                ->where('department_id', $deptId)
                ->where('role', UserRole::Lecturer->value)
                ->count(),
            'courses'            => Course::where('department_id', $deptId)->count(),
            'students'           => Student::where('school_id', $schoolId)
                ->whereHas('combination.departments', fn ($q) => $q->where('departments.id', $deptId))
                ->count(),
            'pending_moderation' => QuestionBank::whereHas('course', fn ($q) => $q->where('department_id', $deptId))
                ->whereIn('status', [
                    QuestionBankStatus::Submitted->value,
                    QuestionBankStatus::UnderReview->value,
                ])
                ->count(),
        ]);
    }
}
