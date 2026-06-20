<?php

use App\Http\Middleware\EnsureOfflineMode;
use App\Http\Middleware\EnsureRole;
use App\Http\Middleware\EnsureSchoolScope;
use App\Http\Middleware\ForcePasswordChange;
use App\Http\Middleware\ResolveExamSession;
use App\Http\Middleware\SyncSecretKeyAuth;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function (): void {
            \Illuminate\Support\Facades\Route::middleware('api')
                ->prefix('api')
                ->group(__DIR__.'/../routes/sync.php');
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'role' => EnsureRole::class,
            'school.scope' => EnsureSchoolScope::class,
            'sync.secret' => SyncSecretKeyAuth::class,
            'offline.mode' => EnsureOfflineMode::class,
            'exam.session' => ResolveExamSession::class,
            'password.changed' => ForcePasswordChange::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })->create();
