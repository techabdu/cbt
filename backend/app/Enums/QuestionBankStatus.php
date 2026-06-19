<?php

namespace App\Enums;

enum QuestionBankStatus: string
{
    case Draft = 'draft';
    case Submitted = 'submitted';
    case UnderReview = 'under_review';
    case Approved = 'approved';
    case Rejected = 'rejected';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Submitted => 'Submitted',
            self::UnderReview => 'Under Review',
            self::Approved => 'Approved',
            self::Rejected => 'Rejected',
        };
    }

    /**
     * A bank is editable by its lecturer only while in these states.
     */
    public function isEditable(): bool
    {
        return $this === self::Draft || $this === self::Rejected;
    }

    /**
     * A bank can be moderated by the exam officer only while in these states.
     */
    public function isModeratable(): bool
    {
        return $this === self::Submitted || $this === self::UnderReview;
    }
}
