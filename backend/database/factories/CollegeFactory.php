<?php

namespace Database\Factories;

use App\Models\College;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<College>
 */
class CollegeFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name'          => fake()->company() . ' College of Education',
            'contact_email' => fake()->safeEmail(),
            'contact_phone' => fake()->phoneNumber(),
            'address'       => fake()->address(),
        ];
    }
}
