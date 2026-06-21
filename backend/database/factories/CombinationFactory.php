<?php

namespace Database\Factories;

use App\Models\School;
use Illuminate\Database\Eloquent\Factories\Factory;

class CombinationFactory extends Factory
{
    public function definition(): array
    {
        $code = strtoupper(fake()->unique()->lexify('???')) . '/' . strtoupper(fake()->lexify('???'));

        return [
            'school_id' => School::factory(),
            'name'      => ucfirst(fake()->words(2, true)),
            'code'      => $code,
        ];
    }
}
