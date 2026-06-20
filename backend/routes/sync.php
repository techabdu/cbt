<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Server-to-Server Sync Routes
|--------------------------------------------------------------------------
|
| These endpoints are authenticated by the shared X-Sync-Secret header
| (sync.secret middleware), NOT by Sanctum user tokens. They are loaded under
| the /api prefix in bootstrap/app.php.
|
| Flow:
|   - Online server PUSHES exam data  -> offline server receives at receive-exam
|   - Online server PULLS results      -> offline server exposes at results/{exam}
|
| Controllers are added in Phases 8–9.
|
*/

Route::prefix('sync')->middleware('sync.secret')->group(function (): void {
    // Phase 8 — Offline receives pushed exam payload
    Route::post('/receive-exam', [\App\Http\Controllers\Sync\PushReceiveController::class, 'store']);

    // Phase 9 — Online pulls results from offline
    Route::get('/results/{exam}', [\App\Http\Controllers\Sync\ResultsPullController::class, 'show']);
});
