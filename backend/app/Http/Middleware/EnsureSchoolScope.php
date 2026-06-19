<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSchoolScope
{
    /**
     * Resolve the school an exam officer is scoped to and stash it on the request
     * so controllers and policies can constrain queries without re-deriving it.
     *
     * Super admins and CBT admins are system-wide and bypass scoping; their
     * requested school (if any) is taken from the `school_id` input instead.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->role === UserRole::ExamOfficer) {
            if (! $user->school_id) {
                abort(403, 'Your account is not attached to a school.');
            }

            $request->attributes->set('school_id', $user->school_id);
        } elseif ($user && $user->hasAtLeastRole(UserRole::CbtAdmin)) {
            // System-wide roles may optionally target a specific school.
            $request->attributes->set('school_id', $request->input('school_id'));
        }

        return $next($request);
    }
}
