<?php

namespace App\Models;

use App\Enums\Semester;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentCourse extends Model
{
    protected $fillable = [
        'student_id',
        'course_id',
        'session',
        'semester',
    ];

    protected function casts(): array
    {
        return [
            'semester' => Semester::class,
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }
}
