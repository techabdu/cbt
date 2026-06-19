<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExamResult extends Model
{
    protected $fillable = [
        'exam_id',
        'student_id',
        'total_score',
        'total_marks',
        'percentage',
        'grade',
        'is_absent',
        'synced_at',
    ];

    protected function casts(): array
    {
        return [
            'total_score' => 'decimal:2',
            'total_marks' => 'decimal:2',
            'percentage' => 'decimal:2',
            'is_absent' => 'boolean',
            'synced_at' => 'datetime',
        ];
    }

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }
}
