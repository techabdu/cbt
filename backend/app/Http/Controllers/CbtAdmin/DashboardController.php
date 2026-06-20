<?php

namespace App\Http\Controllers\CbtAdmin;

use App\Enums\ExamStatus;
use App\Enums\QuestionBankStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamCode;
use App\Models\QuestionBank;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function stats(): JsonResponse
    {
        return response()->json([
            'approved_banks'  => QuestionBank::where('status', QuestionBankStatus::Approved->value)
                ->whereDoesntHave('course.exams')
                ->count(),
            'scheduled_exams' => Exam::where('status', ExamStatus::Scheduled->value)->count(),
            'synced_exams'    => Exam::where('status', ExamStatus::Synced->value)->count(),
            'total_exams'     => Exam::count(),
            'codes_generated' => ExamCode::count(),
            'exam_officers'   => User::where('role', UserRole::ExamOfficer->value)->where('is_active', true)->count(),
        ]);
    }
}
