<?php

namespace App\Models;

use App\Enums\StudentLevel;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Student extends Model
{
    use HasFactory;

    protected $fillable = [
        'matric_number',
        'full_name',
        'department_id',
        'school_id',
        'level',
        'photo_path',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'level' => StudentLevel::class,
            'is_active' => 'boolean',
        ];
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function courses(): BelongsToMany
    {
        return $this->belongsToMany(Course::class, 'student_courses')
            ->withPivot(['session', 'semester'])
            ->withTimestamps();
    }

    public function examCodes(): HasMany
    {
        return $this->hasMany(ExamCode::class);
    }

    public function results(): HasMany
    {
        return $this->hasMany(ExamResult::class);
    }
}
