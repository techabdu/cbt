<?php

namespace App\Http\Middleware;

use App\Services\ExamSessionService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolves the in-progress exam session for a student from the stateless
 * X-Exam-Token header. Students have no Sanctum account; this token is the only
 * credential for the answer/submit/resume endpoints.
 */
class ResolveExamSession
{
    public function __construct(private readonly ExamSessionService $sessions) {}

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->header('X-Exam-Token')
            ?? $request->bearerToken();

        $session = $token ? $this->sessions->resolveToken($token) : null;

        if (! $session) {
            abort(401, 'Your exam session is invalid or has expired.');
        }

        $request->attributes->set('exam_session', $session);

        return $next($request);
    }
}
