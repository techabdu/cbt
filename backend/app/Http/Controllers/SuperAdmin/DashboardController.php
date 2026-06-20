<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    /**
     * High-level counts for the Super Admin overview + health page.
     */
    public function stats(): JsonResponse
    {
        return response()->json([
            'schools'       => School::count(),
            'students'      => Student::count(),
            'cbt_admins'    => User::where('role', UserRole::CbtAdmin->value)->count(),
            'exam_officers' => User::where('role', UserRole::ExamOfficer->value)->count(),
            'lecturers'     => User::where('role', UserRole::Lecturer->value)->count(),
            'active_users'  => User::where('is_active', true)->count(),
            'is_offline_server' => (bool) config('cbt.is_offline_server'),
            'server_time'   => now()->toIso8601String(),
        ]);
    }
}
