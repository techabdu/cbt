<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    /**
     * Gate a route by role using the role hierarchy.
     *
     * The parameters are the roles permitted on the route. A user passes if their
     * role *equals or outranks* the lowest-ranked role listed, so listing the
     * minimum role is enough (e.g. `role:lecturer` also admits exam officers,
     * CBT admins and super admins).
     *
     * Usage: ->middleware('role:exam_officer')
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user || ! $user->is_active) {
            abort(401, 'Unauthenticated.');
        }

        $minRank = collect($roles)
            ->map(fn (string $role) => UserRole::from($role)->rank())
            ->min();

        if ($user->role->rank() < $minRank) {
            abort(403, 'You do not have permission to perform this action.');
        }

        return $next($request);
    }
}
