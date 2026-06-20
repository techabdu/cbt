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

            // Phase 9 — Results view & export
        });

        /*
        |----------------------------------------------------------------------
        | Exam Officer (role >= exam_officer), scoped to their school
        |----------------------------------------------------------------------
        */
        Route::prefix('exam-officer')->middleware(['role:exam_officer', 'school.scope'])->group(function (): void {
            // Phase 4 — Lecturers/Students/Courses/Departments CRUD + assignments
            Route::get('/stats', [\App\Http\Controllers\ExamOfficer\DashboardController::class, 'stats']);

            Route::apiResource('departments', \App\Http\Controllers\ExamOfficer\DepartmentController::class);

            Route::apiResource('lecturers', \App\Http\Controllers\ExamOfficer\LecturerController::class)
                ->except(['show']);
            Route::post('/lecturers/{lecturer}/reset-password', [\App\Http\Controllers\ExamOfficer\LecturerController::class, 'resetPassword']);

            Route::apiResource('students', \App\Http\Controllers\ExamOfficer\StudentController::class);

            Route::apiResource('courses', \App\Http\Controllers\ExamOfficer\CourseController::class);

            // Course ↔ lecturer assignments
            Route::get('/courses/{course}/lecturers', [\App\Http\Controllers\ExamOfficer\AssignmentController::class, 'courseLecturers']);
            Route::post('/courses/{course}/assign-lecturer', [\App\Http\Controllers\ExamOfficer\AssignmentController::class, 'assignLecturer']);
            Route::delete('/courses/{course}/lecturers/{lecturer}', [\App\Http\Controllers\ExamOfficer\AssignmentController::class, 'removeLecturer']);

            // Course ↔ student enrolments
            Route::get('/courses/{course}/students', [\App\Http\Controllers\ExamOfficer\AssignmentController::class, 'courseStudents']);
            Route::post('/courses/{course}/assign-students', [\App\Http\Controllers\ExamOfficer\AssignmentController::class, 'assignStudents']);
            Route::delete('/courses/{course}/students/{student}', [\App\Http\Controllers\ExamOfficer\AssignmentController::class, 'removeStudent']);

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
            // Phase 8/9 — Sync push/pull triggers + sync logs
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
    // Phase 8 — Student login (matric + exam code), start, answer autosave, submit
});
