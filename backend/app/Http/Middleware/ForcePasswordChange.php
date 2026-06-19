<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ForcePasswordChange
{
    /**
     * Block API access for users who must change their password on first login.
     * Returns 423 Locked so the frontend can intercept and redirect to the
     * change-password screen. The change-password route itself is exempt.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->force_password_change) {
            return response()->json([
                'message' => 'You must change your password before continuing.',
                'force_password_change' => true,
            ], 423);
        }

        return $next($request);
    }
}
