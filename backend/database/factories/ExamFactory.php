<?php

namespace Database\Factories;

use App\Enums\ExamStatus;
use App\Enums\Semester;
use App\Models\Course;
use App\Models\QuestionBank;
use Illuminate\Database\Eloquent\Factories\Factory;

class ExamFactory extends Factory
{
    public function definition(): array
    {
        return [
            'course_id'        => Course::factory(),
            'question_bank_id' => QuestionBank::factory(),
            'session'          => '2024/2025',
            'semester'         => fake()->randomElement(Semester::cases())->value,
            'exam_date'        => now()->addWeek()->toDateString(),
            'start_time'       => '09:00',
            'duration_minutes' => 60,
            'status'           => ExamStatus::Scheduled->value,
            'configured_by'    => null,
        ];
    }

    public function status(ExamStatus $status): static
    {
        return $this->state(fn () => ['status' => $status->value]);
    }
}
