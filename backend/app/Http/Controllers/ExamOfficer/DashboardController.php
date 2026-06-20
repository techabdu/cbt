<?php

namespace App\Http\Controllers\ExamOfficer;

use App\Enums\QuestionBankStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Department;
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

        return response()->json([
            'lecturers'          => User::where('school_id', $schoolId)
                ->where('role', UserRole::Lecturer->value)
                ->count(),
            'students'           => Student::where('school_id', $schoolId)->count(),
            'courses'            => Course::where('school_id', $schoolId)->count(),
            'departments'        => Department::where('school_id', $schoolId)->count(),
            'pending_moderation' => QuestionBank::whereHas('course', fn ($q) => $q->where('school_id', $schoolId))
                ->whereIn('status', [
                    QuestionBankStatus::Submitted->value,
                    QuestionBankStatus::UnderReview->value,
                ])
                ->count(),
        ]);
    }
}
