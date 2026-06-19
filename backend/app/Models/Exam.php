<?php

namespace App\Models;

use App\Enums\ExamStatus;
use App\Enums\Semester;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Exam extends Model
{
    use HasFactory;

    protected $fillable = [
        'course_id',
        'question_bank_id',
        'session',
        'semester',
        'exam_date',
        'start_time',
        'duration_minutes',
        'status',
        'configured_by',
    ];

    protected function casts(): array
    {
        return [
            'semester' => Semester::class,
            'status' => ExamStatus::class,
            'exam_date' => 'date',
            'duration_minutes' => 'integer',
        ];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function questionBank(): BelongsTo
    {
        return $this->belongsTo(QuestionBank::class);
    }

    public function configuredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'configured_by');
    }

    public function codes(): HasMany
    {
        return $this->hasMany(ExamCode::class);
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(ExamSession::class);
    }

    public function results(): HasMany
    {
        return $this->hasMany(ExamResult::class);
    }
}
