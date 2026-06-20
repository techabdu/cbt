<?php

namespace Database\Factories;

use App\Enums\StudentLevel;
use App\Models\Department;
use App\Models\School;
use Illuminate\Database\Eloquent\Factories\Factory;

class StudentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'matric_number' => 'NCE/' . fake()->unique()->numerify('####/####'),
            'full_name'     => fake()->name(),
            'school_id'     => School::factory(),
            'department_id' => Department::factory(),
            'level'         => fake()->randomElement(StudentLevel::cases())->value,
            'photo_path'    => null,
            'is_active'     => true,
        ];
    }
}
