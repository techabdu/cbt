<?php

namespace App\Console\Commands;

use App\Services\ExamSessionService;
use Illuminate\Console\Command;

/**
 * Scheduled safety net for the client-side timer: any open session whose time
 * (plus the server grace window) has run out is force-submitted and queued for
 * grading, so a crashed or tampered-with browser still produces a result.
 */
class SubmitExpiredSessions extends Command
{
    protected $signature = 'exam:submit-expired';

    protected $description = 'Force-submit exam sessions whose time has expired and queue them for grading';

    public function handle(ExamSessionService $sessions): int
    {
        $count = $sessions->sweepExpiredSessions();

        $this->info("Submitted {$count} expired exam session(s).");

        return self::SUCCESS;
    }
}
