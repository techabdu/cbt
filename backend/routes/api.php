<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Staff-facing API. Routes are grouped by the minimum role required (the
| `role` middleware honours the role hierarchy, so higher roles inherit
| lower-role routes). Controllers are added per build phase — this file
| currently defines the group skeleton only.
|
| Student exam routes live in routes/sync.php's sibling area and are gated by
| the offline.mode middleware; server-to-server sync lives in routes/sync.php.
|
*/

Route::get('/health', fn () => response()->json([
    'status' => 'ok',
    'offline_server' => (bool) config('cbt.is_offline_server'),
    'time' => now()->toIso8601String(),
]));

/*
|--------------------------------------------------------------------------
| Public
|--------------------------------------------------------------------------
*/
// Phase 2 — Auth
Route::post('/auth/login', [\App\Http\Controllers\Auth\AuthController::class, 'login'])
    ->middleware('throttle:login');

/*
|--------------------------------------------------------------------------
| Authenticated (Sanctum)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'throttle:api'])->group(function (): void {

    // Phase 2 — Auth/session
    Route::post('/auth/logout', [\App\Http\Controllers\Auth\AuthController::class, 'logout']);
    Route::get('/auth/me', [\App\Http\Controllers\Auth\AuthController::class, 'me']);
    Route::put('/auth/change-password', [\App\Http\Controllers\Auth\AuthController::class, 'changePassword']);

    // Routes below force a password change before access (except change-password above).
    Route::middleware('password.changed')->group(function (): void {

        // Notifications (all authenticated roles) — database channel, polled by the bell
        Route::get('/notifications', [\App\Http\Controllers\NotificationController::class, 'index']);
        Route::patch('/notifications/{id}/read', [\App\Http\Controllers\NotificationController::class, 'markRead']);
        Route::post('/notifications/mark-all-read', [\App\Http\Controllers\NotificationController::class, 'markAllRead']);

        /*
        |----------------------------------------------------------------------
        | Lecturer (role >= lecturer)
        |----------------------------------------------------------------------
        */
        Route::prefix('lecturer')->middleware('role:lecturer')->group(function (): void {
            // Phase 5 — Question banks & questions
            Route::get('/courses', [\App\Http\Controllers\Lecturer\CourseController::class, 'index']);

            Route::apiResource('question-banks', \App\Http\Controllers\Lecturer\QuestionBankController::class)
                ->parameters(['question-banks' => 'questionBank']);
            Route::post('/question-banks/{questionBank}/submit', [\App\Http\Controllers\Lecturer\QuestionBankController::class, 'submit']);

            Route::apiResource('question-banks.questions', \App\Http\Controllers\Lecturer\QuestionController::class)
                ->parameters(['question-banks' => 'questionBank'])
                ->only(['store', 'update', 'destroy']);

            // Students enrolled in the lecturer's courses (read-only roster)
            Route::get('/students', [\App\Http\Controllers\Lecturer\StudentController::class, 'index']);

            // Phase 9 — Results view & export
            Route::get('/results', [\App\Http\Controllers\Lecturer\ResultController::class, 'index']);
            Route::get('/results/{exam}', [\App\Http\Controllers\Lecturer\ResultController::class, 'show']);
            Route::get('/results/{exam}/export/pdf', [\App\Http\Controllers\Lecturer\ResultController::class, 'exportPdf']);
            Route::get('/results/{exam}/export/excel', [\App\Http\Controllers\Lecturer\ResultController::class, 'exportExcel']);
        });

        /*
        |----------------------------------------------------------------------
        | Department Exam Officer (role >= department_exam_officer), scoped to
        | their department. Owns courses, lecturers and lecturer→course
        | assignment within one department.
        |----------------------------------------------------------------------
        */
        Route::prefix('department-officer')->middleware(['role:department_exam_officer', 'department.scope'])->group(function (): void {
            Route::get('/stats', [\App\Http\Controllers\DepartmentOfficer\DashboardController::class, 'stats']);

            Route::apiResource('courses', \App\Http\Controllers\DepartmentOfficer\CourseController::class);

            Route::apiResource('lecturers', \App\Http\Controllers\DepartmentOfficer\LecturerController::class)
                ->except(['show']);
            Route::post('/lecturers/{lecturer}/reset-password', [\App\Http\Controllers\DepartmentOfficer\LecturerController::class, 'resetPassword']);

            // Course ↔ lecturer assignments + read-only course roster
            Route::get('/courses/{course}/lecturers', [\App\Http\Controllers\DepartmentOfficer\AssignmentController::class, 'courseLecturers']);
            Route::post('/courses/{course}/assign-lecturer', [\App\Http\Controllers\DepartmentOfficer\AssignmentController::class, 'assignLecturer']);
            Route::delete('/courses/{course}/lecturers/{lecturer}', [\App\Http\Controllers\DepartmentOfficer\AssignmentController::class, 'removeLecturer']);
            Route::get('/courses/{course}/students', [\App\Http\Controllers\DepartmentOfficer\AssignmentController::class, 'courseStudents']);

            // Read-only student roster (combinations that include this department)
            Route::get('/students', [\App\Http\Controllers\DepartmentOfficer\StudentController::class, 'index']);

            // Read-only oversight of the department's lecturers' activity
            Route::get('/lecturer-activity', [\App\Http\Controllers\DepartmentOfficer\LecturerActivityController::class, 'index']);
            Route::get('/lecturer-activity/{lecturer}/question-banks', [\App\Http\Controllers\DepartmentOfficer\LecturerActivityController::class, 'questionBanks']);
            Route::get('/lecturer-activity/{lecturer}/courses', [\App\Http\Controllers\DepartmentOfficer\LecturerActivityController::class, 'courses']);
        });

        /*
        |----------------------------------------------------------------------
        | Exam Officer (role >= exam_officer), scoped to their school
        |----------------------------------------------------------------------
        */
        Route::prefix('exam-officer')->middleware(['role:exam_officer', 'school.scope'])->group(function (): void {
            // School-level administration: departments, combinations, the academic
            // calendar, student registration + combination assignment, the
            // department-officer roster, moderation and read-only oversight.
            Route::get('/stats', [\App\Http\Controllers\ExamOfficer\DashboardController::class, 'stats']);

            Route::apiResource('departments', \App\Http\Controllers\ExamOfficer\DepartmentController::class);

            Route::apiResource('students', \App\Http\Controllers\ExamOfficer\StudentController::class);

            // Combinations (combined NCE majors)
            Route::apiResource('combinations', \App\Http\Controllers\ExamOfficer\CombinationController::class);
            Route::get('/combinations/{combination}/students', [\App\Http\Controllers\ExamOfficer\CombinationAssignmentController::class, 'students']);
            Route::post('/combinations/{combination}/assign-students', [\App\Http\Controllers\ExamOfficer\CombinationAssignmentController::class, 'assign']);
            Route::delete('/combinations/{combination}/students/{student}', [\App\Http\Controllers\ExamOfficer\CombinationAssignmentController::class, 'remove']);

            // Academic calendar (sessions + current semester)
            Route::get('/academic-calendar', [\App\Http\Controllers\ExamOfficer\AcademicCalendarController::class, 'index']);
            Route::post('/academic-calendar/sessions', [\App\Http\Controllers\ExamOfficer\AcademicCalendarController::class, 'storeSession']);
            Route::post('/academic-calendar/sessions/{academicSession}/set-current', [\App\Http\Controllers\ExamOfficer\AcademicCalendarController::class, 'setCurrentSession']);
            Route::delete('/academic-calendar/sessions/{academicSession}', [\App\Http\Controllers\ExamOfficer\AcademicCalendarController::class, 'destroySession']);
            Route::put('/academic-calendar/semester', [\App\Http\Controllers\ExamOfficer\AcademicCalendarController::class, 'setSemester']);

            // Department Exam Officers
            Route::get('/department-officers', [\App\Http\Controllers\ExamOfficer\DepartmentOfficerController::class, 'index']);
            Route::get('/department-officers/eligible', [\App\Http\Controllers\ExamOfficer\DepartmentOfficerController::class, 'eligible']);
            Route::post('/department-officers', [\App\Http\Controllers\ExamOfficer\DepartmentOfficerController::class, 'store']);
            Route::post('/department-officers/{user}/promote', [\App\Http\Controllers\ExamOfficer\DepartmentOfficerController::class, 'promote']);
            Route::post('/department-officers/{user}/demote', [\App\Http\Controllers\ExamOfficer\DepartmentOfficerController::class, 'demote']);
            Route::post('/department-officers/{user}/reset-password', [\App\Http\Controllers\ExamOfficer\DepartmentOfficerController::class, 'resetPassword']);
            Route::delete('/department-officers/{user}', [\App\Http\Controllers\ExamOfficer\DepartmentOfficerController::class, 'destroy']);

            // Read-only oversight across all departments
            Route::get('/oversight/courses', [\App\Http\Controllers\ExamOfficer\OversightController::class, 'courses']);
            Route::get('/oversight/lecturers', [\App\Http\Controllers\ExamOfficer\OversightController::class, 'lecturers']);

            // Phase 6 — Moderation (approve/reject question banks)
            Route::get('/moderation', [\App\Http\Controllers\ExamOfficer\ModerationController::class, 'index']);
            Route::get('/moderation/{questionBank}', [\App\Http\Controllers\ExamOfficer\ModerationController::class, 'show']);
            Route::post('/moderation/{questionBank}/approve', [\App\Http\Controllers\ExamOfficer\ModerationController::class, 'approve']);
            Route::post('/moderation/{questionBank}/reject', [\App\Http\Controllers\ExamOfficer\ModerationController::class, 'reject']);
        });

        /*
        |----------------------------------------------------------------------
        | CBT Admin (role >= cbt_admin)
        |----------------------------------------------------------------------
        */
        Route::prefix('cbt-admin')->middleware('role:cbt_admin')->group(function (): void {
            // Phase 7 — Exams, code generation, role management
            Route::get('/stats', [\App\Http\Controllers\CbtAdmin\DashboardController::class, 'stats']);

            // School Exam Officer accounts — create directly and assign to a school
            // (fills the onboarding bootstrap: a brand-new school has no staff yet,
            // so there is no lecturer to promote). Schools are read-only here, for
            // the assign-to-school picker.
            Route::get('/schools', [\App\Http\Controllers\CbtAdmin\SchoolController::class, 'index']);
            // Departments of a school (filter[school_id]) for the optional
            // "attach to department" selector on the Exam Officer form.
            Route::get('/departments', [\App\Http\Controllers\CbtAdmin\DepartmentController::class, 'index']);
            Route::apiResource('exam-officers', \App\Http\Controllers\CbtAdmin\ExamOfficerController::class)
                ->parameters(['exam-officers' => 'exam_officer'])
                ->except(['show']);
            Route::post('/exam-officers/{exam_officer}/reset-password', [\App\Http\Controllers\CbtAdmin\ExamOfficerController::class, 'resetPassword']);

            // Approved question banks (read-only) to build exams from
            Route::get('/question-banks', [\App\Http\Controllers\CbtAdmin\QuestionBankController::class, 'index']);
            Route::get('/question-banks/{questionBank}', [\App\Http\Controllers\CbtAdmin\QuestionBankController::class, 'show']);

            // Exams
            Route::apiResource('exams', \App\Http\Controllers\CbtAdmin\ExamController::class);

            // Exam codes (nested under an exam)
            Route::get('/exams/{exam}/codes', [\App\Http\Controllers\CbtAdmin\ExamCodeController::class, 'index']);
            Route::post('/exams/{exam}/codes/generate', [\App\Http\Controllers\CbtAdmin\ExamCodeController::class, 'generate']);

            // Role management (promote lecturers ↔ demote exam officers)
            Route::get('/role-management', [\App\Http\Controllers\CbtAdmin\RoleManagementController::class, 'index']);
            Route::get('/role-management/history', [\App\Http\Controllers\CbtAdmin\RoleManagementController::class, 'history']);
            Route::post('/role-management/{user}/promote', [\App\Http\Controllers\CbtAdmin\RoleManagementController::class, 'promote']);
            Route::post('/role-management/{user}/demote', [\App\Http\Controllers\CbtAdmin\RoleManagementController::class, 'demote']);

            // Phase 8+9 — Sync push/pull + sync activity log
            Route::post('/exams/{exam}/sync', [\App\Http\Controllers\CbtAdmin\SyncController::class, 'push']);
            Route::post('/exams/{exam}/pull-results', [\App\Http\Controllers\CbtAdmin\SyncController::class, 'pull']);
            Route::get('/sync-logs', [\App\Http\Controllers\CbtAdmin\SyncController::class, 'logs']);
        });

        /*
        |----------------------------------------------------------------------
        | Super Admin (role = super_admin)
        |----------------------------------------------------------------------
        */
        Route::prefix('super-admin')->middleware('role:super_admin')->group(function (): void {
            // Phase 3 — College settings, schools CRUD, CBT admin accounts, audit logs
            Route::get('/stats', [\App\Http\Controllers\SuperAdmin\DashboardController::class, 'stats']);

            Route::get('/college', [\App\Http\Controllers\SuperAdmin\CollegeController::class, 'show']);
            Route::put('/college', [\App\Http\Controllers\SuperAdmin\CollegeController::class, 'update']);

            Route::apiResource('schools', \App\Http\Controllers\SuperAdmin\SchoolController::class);

            Route::apiResource('cbt-admins', \App\Http\Controllers\SuperAdmin\CbtAdminController::class)
                ->parameters(['cbt-admins' => 'cbt_admin'])
                ->except(['show']);
            Route::post('/cbt-admins/{cbt_admin}/reset-password', [\App\Http\Controllers\SuperAdmin\CbtAdminController::class, 'resetPassword']);

            Route::get('/audit-logs', [\App\Http\Controllers\SuperAdmin\AuditLogController::class, 'index']);
        });
    });
});

/*
|--------------------------------------------------------------------------
| Student Exam (offline server only)
|--------------------------------------------------------------------------
*/
Route::prefix('student/exam')->middleware('offline.mode')->group(function (): void {
    // Phase 8 — Student login (matric + exam code), then token-authenticated flow
    Route::post('/login', [\App\Http\Controllers\Student\ExamController::class, 'login']);

    Route::middleware('exam.session')->group(function (): void {
        Route::get('/resume', [\App\Http\Controllers\Student\ExamController::class, 'resume']);
        Route::post('/answer', [\App\Http\Controllers\Student\ExamController::class, 'answer']);
        Route::post('/autosave', [\App\Http\Controllers\Student\ExamController::class, 'autosave']);
        Route::post('/submit', [\App\Http\Controllers\Student\ExamController::class, 'submit']);
    });
});
