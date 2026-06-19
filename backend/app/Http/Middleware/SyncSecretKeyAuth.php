<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SyncSecretKeyAuth
{
    /**
     * Authenticate server-to-server sync requests via a shared secret header.
     * No Sanctum tokens are involved on these endpoints.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $expected = config('cbt.sync_secret_key');
        $provided = $request->header('X-Sync-Secret');

        if (! $expected || ! $provided || ! hash_equals($expected, $provided)) {
            abort(401, 'Invalid sync credentials.');
        }

        return $next($request);
    }
}
