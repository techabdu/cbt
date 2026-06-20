<?php

namespace Database\Factories;

use App\Enums\QuestionBankStatus;
use App\Enums\Semester;
use App\Models\Course;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class QuestionBankFactory extends Factory
{
    public function definition(): array
    {
        return [
            'lecturer_id'     => User::factory(),
            'course_id'       => Course::factory(),
            'title'           => fake()->sentence(3),
            'session'         => '2024/2025',
            'semester'        => fake()->randomElement(Semester::cases())->value,
            'total_questions' => 0,
            'status'          => QuestionBankStatus::Draft->value,
        ];
    }

    public function status(QuestionBankStatus $status): static
    {
        return $this->state(fn () => ['status' => $status->value]);
    }
}
