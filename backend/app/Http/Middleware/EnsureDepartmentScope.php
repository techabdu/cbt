<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureDepartmentScope
{
    /**
     * Resolve the department a Department Exam Officer is scoped to and stash it
     * (with the school) on the request so controllers can constrain queries.
     *
     * A Department Exam Officer is locked to their own department. Higher roles
     * (School Exam Officer and above) reach these routes through the role
     * hierarchy and target a department explicitly via the `department_id` input
     * — a School Exam Officer is further pinned to their own school.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->role === UserRole::DepartmentExamOfficer) {
            if (! $user->department_id || ! $user->school_id) {
                abort(403, 'Your account is not attached to a department.');
            }

            $request->attributes->set('school_id', $user->school_id);
            $request->attributes->set('department_id', $user->department_id);
        } elseif ($user && $user->role === UserRole::ExamOfficer) {
            if (! $user->school_id) {
                abort(403, 'Your account is not attached to a school.');
            }

            $request->attributes->set('school_id', $user->school_id);
            $request->attributes->set('department_id', $request->input('department_id'));
        } elseif ($user && $user->hasAtLeastRole(UserRole::CbtAdmin)) {
            // System-wide roles may optionally target a specific school + department.
            $request->attributes->set('school_id', $request->input('school_id'));
            $request->attributes->set('department_id', $request->input('department_id'));
        }

        return $next($request);
    }
}
