<?php

namespace App\Models;

use App\Enums\Semester;
use App\Enums\StudentLevel;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Course extends Model
{
    use HasFactory;

    protected $fillable = [
        'school_id',
        'department_id',
        'title',
        'code',
        'credit_units',
        'level',
        'semester',
    ];

    protected function casts(): array
    {
        return [
            'level' => StudentLevel::class,
            'semester' => Semester::class,
            'credit_units' => 'integer',
        ];
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function students(): BelongsToMany
    {
        return $this->belongsToMany(Student::class, 'student_courses')
            ->withPivot(['session', 'semester'])
            ->withTimestamps();
    }

    public function lecturers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'lecturer_courses', 'course_id', 'lecturer_id')
            ->withPivot(['session', 'semester'])
            ->withTimestamps();
    }

    public function questionBanks(): HasMany
    {
        return $this->hasMany(QuestionBank::class);
    }

    public function exams(): HasMany
    {
        return $this->hasMany(Exam::class);
    }
}
