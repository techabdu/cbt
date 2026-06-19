<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureOfflineMode
{
    /**
     * Gate the student exam routes so they only exist on the offline server.
     * On the online server this returns 403, keeping the exam interface entirely
     * unreachable from the public internet.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('cbt.is_offline_server')) {
            abort(403, 'Exam routes are only available on the offline server.');
        }

        return $next($request);
    }
}
