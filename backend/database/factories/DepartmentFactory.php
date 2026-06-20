<?php

namespace Database\Factories;

use App\Models\School;
use Illuminate\Database\Eloquent\Factories\Factory;

class DepartmentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'school_id' => School::factory(),
            'name'      => fake()->unique()->word() . ' Department',
            'code'      => strtoupper(fake()->unique()->lexify('???')),
            'full_name' => null,
        ];
    }
}
