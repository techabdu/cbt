<?php

namespace App\Jobs;

use App\Models\ExamSession;
use App\Services\AutoGradingService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Grades a submitted exam session off the request thread.
 *
 * Submitting an exam used to grade inline, which collapsed the app at the end of
 * an exam when every student's timer hit zero at the same instant (a synchronised
 * auto-submit spike of thousands of full-question-bank grading passes). Grading is
 * now queued and processed by a dedicated worker pool, and dispatched with a small
 * random delay so that spike is spread across several seconds instead of landing
 * all at once.
 *
 * ShouldBeUnique (keyed by the session id) means a re-submit or a retry never
 * grades the same session twice concurrently; gradeSession() is itself idempotent
 * (it upserts the answers and the aggregate result), so re-running is always safe.
 */
class GradeExamSession implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    /** Retry a few times — transient DB hiccups under load shouldn't lose a grade. */
    public int $tries = 5;

    public int $backoff = 10;

    public function __construct(public readonly int $examSessionId)
    {
        $this->onQueue('grading');
    }

    /**
     * Keep the unique lock around long enough to cover retries, but not forever.
     */
    public function uniqueId(): string
    {
        return (string) $this->examSessionId;
    }

    public function uniqueFor(): int
    {
        return 3600;
    }

    public function handle(AutoGradingService $grading): void
    {
        $session = ExamSession::with('exam')->find($this->examSessionId);

        // Session removed, or submit was rolled back — nothing to grade.
        if (! $session || ! $session->submitted_at) {
            return;
        }

        $grading->gradeSession($session);
    }
}
