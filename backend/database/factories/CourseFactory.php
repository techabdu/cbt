<?php

namespace Database\Factories;

use App\Enums\Semester;
use App\Enums\StudentLevel;
use App\Models\Department;
use App\Models\School;
use Illuminate\Database\Eloquent\Factories\Factory;

class CourseFactory extends Factory
{
    public function definition(): array
    {
        return [
            'school_id'     => School::factory(),
            'department_id' => Department::factory(),
            'title'         => ucfirst(fake()->words(3, true)),
            'code'          => strtoupper(fake()->unique()->lexify('???') . fake()->numerify('###')),
            'credit_units'  => fake()->numberBetween(1, 6),
            'level'         => fake()->randomElement(StudentLevel::cases())->value,
            'semester'      => fake()->randomElement(Semester::cases())->value,
        ];
    }
}
