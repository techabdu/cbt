<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class College extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'logo_path',
        'contact_email',
        'contact_phone',
        'address',
    ];

    public function schools(): HasMany
    {
        return $this->hasMany(School::class);
    }
}
