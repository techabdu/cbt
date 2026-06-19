<?php

namespace App\Enums;

enum StudentLevel: string
{
    case Nce100 = 'NCE_100';
    case Nce200 = 'NCE_200';
    case Nce300 = 'NCE_300';
    case SpilloverI = 'Spillover_I';
    case SpilloverII = 'Spillover_II';

    public function label(): string
    {
        return match ($this) {
            self::Nce100 => '100 Level',
            self::Nce200 => '200 Level',
            self::Nce300 => '300 Level',
            self::SpilloverI => 'Spillover I',
            self::SpilloverII => 'Spillover II',
        };
    }
}
