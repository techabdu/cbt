<?php

namespace App\Enums;

enum QuestionType: string
{
    case Mcq = 'mcq';
    case TrueFalse = 'true_false';
    case FillBlank = 'fill_blank';

    public function label(): string
    {
        return match ($this) {
            self::Mcq => 'Multiple Choice',
            self::TrueFalse => 'True / False',
            self::FillBlank => 'Fill in the Blank',
        };
    }

    /**
     * Whether this question type stores its choices in question_options.
     * Fill-in-the-blank stores its correct answer(s) in question_answers instead.
     */
    public function usesOptions(): bool
    {
        return $this === self::Mcq || $this === self::TrueFalse;
    }
}
