<?php

namespace App\Enums;

enum Semester: string
{
    case First = 'first';
    case Second = 'second';

    public function label(): string
    {
        return match ($this) {
            self::First => 'First Semester',
            self::Second => 'Second Semester',
        };
    }
}
