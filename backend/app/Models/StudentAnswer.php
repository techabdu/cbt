<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentAnswer extends Model
{
    protected $fillable = [
        'exam_session_id',
        'question_id',
        'student_answer',
        'is_correct',
        'marks_earned',
        'order_index',
    ];

    protected function casts(): array
    {
        return [
            'is_correct' => 'boolean',
            'marks_earned' => 'decimal:2',
            'order_index' => 'integer',
        ];
    }

    public function examSession(): BelongsTo
    {
        return $this->belongsTo(ExamSession::class);
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }
}
