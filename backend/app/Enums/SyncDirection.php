<?php

namespace App\Enums;

enum SyncDirection: string
{
    case Push = 'push';
    case Pull = 'pull';

    public function label(): string
    {
        return match ($this) {
            self::Push => 'Push to Offline',
            self::Pull => 'Pull from Offline',
        };
    }
}
