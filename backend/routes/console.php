<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Server-side exam timer: close sessions the client never submitted (crashed
// browser, tampered timer). On the online server every session arrives via
// results sync with submitted_at already set, so this matches nothing there.
Schedule::command('exam:submit-expired')->everyMinute()->withoutOverlapping();
