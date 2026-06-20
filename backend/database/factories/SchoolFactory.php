<?php

namespace Database\Factories;

use App\Models\College;
use Illuminate\Database\Eloquent\Factories\Factory;

class SchoolFactory extends Factory
{
    public function definition(): array
    {
        return [
            'college_id' => College::factory(),
            'name'       => 'School of ' . fake()->unique()->word(),
            'code'       => strtoupper(fake()->unique()->lexify('???')),
            'head_name'  => fake()->name(),
        ];
    }
}
