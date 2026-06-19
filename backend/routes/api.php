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
// Route::post('/auth/login', [\App\Http\Controllers\Auth\AuthController::class, 'login'])
//     ->middleware('throttle:login');

/*
|--------------------------------------------------------------------------
| Authenticated (Sanctum)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'throttle:api'])->group(function (): void {

    // Phase 2 — Auth/session
    // Route::post('/auth/logout', [\App\Http\Controllers\Auth\AuthController::class, 'logout']);
    // Route::get('/auth/me', [\App\Http\Controllers\Auth\AuthController::class, 'me']);
    // Route::put('/auth/change-password', [\App\Http\Controllers\Auth\AuthController::class, 'changePassword']);

    // Routes below force a password change before access (except change-password above).
    Route::middleware('password.changed')->group(function (): void {

        // Phase 10 — Notifications (all authenticated roles)
        // Route::get('/notifications', [\App\Http\Controllers\NotificationController::class, 'index']);
        // Route::patch('/notifications/{id}/read', [\App\Http\Controllers\NotificationController::class, 'markRead']);
        // Route::post('/notifications/mark-all-read', [\App\Http\Controllers\NotificationController::class, 'markAllRead']);

        /*
        |----------------------------------------------------------------------
        | Lecturer (role >= lecturer)
        |----------------------------------------------------------------------
        */
        Route::prefix('lecturer')->middleware('role:lecturer')->group(function (): void {
            // Phase 5 — Question banks & questions
            // Phase 9 — Results view & export
        });

        /*
        |----------------------------------------------------------------------
        | Exam Officer (role >= exam_officer), scoped to their school
        |----------------------------------------------------------------------
        */
        Route::prefix('exam-officer')->middleware(['role:exam_officer', 'school.scope'])->group(function (): void {
            // Phase 4 — Lecturers/Students/Courses/Departments CRUD + assignments
            // Phase 6 — Moderation (approve/reject question banks)
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
