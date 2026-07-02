<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimiting();
    }

    /**
     * Login is throttled per IP; general API traffic is throttled per user
     * (falling back to IP for unauthenticated requests).
     */
    protected function configureRateLimiting(): void
    {
        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(5)->by($request->ip()));

        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(60)
            ->by($request->user()?->id ?: $request->ip()));

        // Student exam login: each student logs in once from their own LAN
        // machine, so 10/min/IP is generous while making exam-code guessing
        // impractical. Applies to /student/exam/login only — the in-exam
        // answer/autosave/submit endpoints must never be throttled.
        RateLimiter::for('exam-login', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));
    }
}
