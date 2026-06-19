<?php

namespace App\Models;

use App\Enums\Semester;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LecturerCourse extends Model
{
    protected $fillable = [
        'lecturer_id',
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

    public function lecturer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'lecturer_id');
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }
}
