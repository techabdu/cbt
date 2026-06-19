<?php

namespace App\Enums;

enum ExamStatus: string
{
    case Scheduled = 'scheduled';
    case Synced = 'synced';
    case Ongoing = 'ongoing';
    case Completed = 'completed';
    case ResultsSynced = 'results_synced';

    public function label(): string
    {
        return match ($this) {
            self::Scheduled => 'Scheduled',
            self::Synced => 'Synced to Offline',
            self::Ongoing => 'Ongoing',
            self::Completed => 'Completed',
            self::ResultsSynced => 'Results Synced',
        };
    }
}
