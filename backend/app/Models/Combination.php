<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Combination extends Model
{
    use HasFactory;

    protected $fillable = [
        'school_id',
        'name',
        'code',
    ];

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    /**
     * The atomic departments this combination couples (e.g. CSC + MAT).
     */
    public function departments(): BelongsToMany
    {
        return $this->belongsToMany(Department::class, 'combination_department')
            ->withTimestamps();
    }

    public function students(): HasMany
    {
        return $this->hasMany(Student::class);
    }
}
