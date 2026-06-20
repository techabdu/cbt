<?php

namespace Tests\Feature\Lecturer;

use App\Enums\QuestionBankStatus;
use App\Enums\UserRole;
use App\Models\College;
use App\Models\Course;
use App\Models\Department;
use App\Models\QuestionBank;
use App\Models\School;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LecturerTest extends TestCase
{
    use RefreshDatabase;

    private School $school;
    private User   $lecturer;
    private Course $course;

    protected function setUp(): void
    {
        parent::setUp();

        College::factory()->create();
        $this->school   = School::factory()->create();
        $dept           = Department::factory()->create(['school_id' => $this->school->id]);
        $this->lecturer = User::factory()->role(UserRole::Lecturer)->create(['school_id' => $this->school->id]);
        $this->course   = Course::factory()->create(['school_id' => $this->school->id, 'department_id' => $dept->id]);

        // Assign the lecturer to the course for a known session/semester.
        $this->course->lecturers()->attach($this->lecturer->id, ['session' => '2024/2025', 'semester' => 'first']);
    }

    private function act(): static
    {
        $this->actingAs($this->lecturer, 'sanctum');
        return $this;
    }

    private function createBank(): QuestionBank
    {
        return QuestionBank::factory()->create([
            'lecturer_id' => $this->lecturer->id,
            'course_id'   => $this->course->id,
            'session'     => '2024/2025',
            'semester'    => 'first',
        ]);
    }

    // ── Access ──────────────────────────────────────────────────────────────

    public function test_assigned_courses_are_listed(): void
    {
        $this->act()->getJson('/api/lecturer/courses')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.session', '2024/2025')
            ->assertJsonPath('data.0.semester', 'first');
    }

    // ── Bank creation ───────────────────────────────────────────────────────

    public function test_can_create_question_bank_for_assigned_course(): void
    {
        $this->act()->postJson('/api/lecturer/question-banks', [
            'course_id' => $this->course->id,
            'title'     => 'Midterm Bank',
            'session'   => '2024/2025',
            'semester'  => 'first',
        ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.title', 'Midterm Bank');
    }

    public function test_cannot_create_bank_for_unassigned_course(): void
    {
        $other = Course::factory()->create(['school_id' => $this->school->id, 'department_id' => $this->course->department_id]);

        $this->act()->postJson('/api/lecturer/question-banks', [
            'course_id' => $other->id,
            'session'   => '2024/2025',
            'semester'  => 'first',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('course_id');
    }

    public function test_cannot_create_bank_for_wrong_session(): void
    {
        $this->act()->postJson('/api/lecturer/question-banks', [
            'course_id' => $this->course->id,
            'session'   => '2025/2026',
            'semester'  => 'first',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('course_id');
    }

    public function test_cannot_view_another_lecturers_bank(): void
    {
        $other = User::factory()->role(UserRole::Lecturer)->create(['school_id' => $this->school->id]);
        $bank  = QuestionBank::factory()->create(['lecturer_id' => $other->id, 'course_id' => $this->course->id]);

        $this->act()->getJson("/api/lecturer/question-banks/{$bank->id}")
            ->assertNotFound();
    }

    // ── Questions: MCQ ──────────────────────────────────────────────────────

    public function test_can_add_mcq_question(): void
    {
        $bank = $this->createBank();

        $this->act()->postJson("/api/lecturer/question-banks/{$bank->id}/questions", [
            'question_text' => 'What is 2 + 2?',
            'question_type' => 'mcq',
            'marks'         => 2,
            'options'       => [
                ['option_text' => '3', 'is_correct' => false],
                ['option_text' => '4', 'is_correct' => true],
                ['option_text' => '5', 'is_correct' => false],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('data.question_type', 'mcq')
            ->assertJsonCount(3, 'data.options');

        $this->assertDatabaseHas('question_options', ['option_label' => 'B', 'option_text' => '4', 'is_correct' => true]);
        $this->assertEquals(1, $bank->fresh()->total_questions);
    }

    public function test_mcq_requires_exactly_one_correct_option(): void
    {
        $bank = $this->createBank();

        $this->act()->postJson("/api/lecturer/question-banks/{$bank->id}/questions", [
            'question_text' => 'Pick two?',
            'question_type' => 'mcq',
            'marks'         => 1,
            'options'       => [
                ['option_text' => 'A', 'is_correct' => true],
                ['option_text' => 'B', 'is_correct' => true],
            ],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('options');
    }

    public function test_mcq_requires_at_least_two_options(): void
    {
        $bank = $this->createBank();

        $this->act()->postJson("/api/lecturer/question-banks/{$bank->id}/questions", [
            'question_text' => 'Only one?',
            'question_type' => 'mcq',
            'marks'         => 1,
            'options'       => [['option_text' => 'A', 'is_correct' => true]],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('options');
    }

    // ── Questions: True/False ───────────────────────────────────────────────

    public function test_can_add_true_false_question(): void
    {
        $bank = $this->createBank();

        $this->act()->postJson("/api/lecturer/question-banks/{$bank->id}/questions", [
            'question_text' => 'The earth is round.',
            'question_type' => 'true_false',
            'marks'         => 1,
            'correct_answer' => 'true',
        ])
            ->assertCreated()
            ->assertJsonCount(2, 'data.options');

        $this->assertDatabaseHas('question_options', ['option_label' => 'T', 'is_correct' => true]);
        $this->assertDatabaseHas('question_options', ['option_label' => 'F', 'is_correct' => false]);
    }

    // ── Questions: Fill blank ───────────────────────────────────────────────

    public function test_can_add_fill_blank_question_with_multiple_answers(): void
    {
        $bank = $this->createBank();

        $this->act()->postJson("/api/lecturer/question-banks/{$bank->id}/questions", [
            'question_text' => 'Capital of France?',
            'question_type' => 'fill_blank',
            'marks'         => 1,
            'answers'       => ['Paris', 'paris'],
        ])
            ->assertCreated()
            ->assertJsonCount(2, 'data.answers');

        $this->assertDatabaseHas('question_answers', ['correct_answer' => 'Paris']);
    }

    // ── Question editing / deleting ─────────────────────────────────────────

    public function test_can_update_question_and_replace_options(): void
    {
        $bank = $this->createBank();
        $create = $this->act()->postJson("/api/lecturer/question-banks/{$bank->id}/questions", [
            'question_text' => 'Old?',
            'question_type' => 'mcq',
            'marks'         => 1,
            'options'       => [
                ['option_text' => 'A', 'is_correct' => true],
                ['option_text' => 'B', 'is_correct' => false],
            ],
        ])->json('data.id');

        $this->act()->putJson("/api/lecturer/question-banks/{$bank->id}/questions/{$create}", [
            'question_text' => 'New fill blank?',
            'question_type' => 'fill_blank',
            'marks'         => 3,
            'answers'       => ['answer'],
        ])
            ->assertOk()
            ->assertJsonPath('data.question_type', 'fill_blank')
            ->assertJsonPath('data.marks', 3);

        // Old options should be gone.
        $this->assertDatabaseMissing('question_options', ['question_id' => $create]);
        $this->assertDatabaseHas('question_answers', ['question_id' => $create, 'correct_answer' => 'answer']);
    }

    public function test_deleting_question_resequences_order(): void
    {
        $bank = $this->createBank();
        $ids = [];
        foreach (['Q1', 'Q2', 'Q3'] as $text) {
            $ids[] = $this->act()->postJson("/api/lecturer/question-banks/{$bank->id}/questions", [
                'question_text' => $text,
                'question_type' => 'fill_blank',
                'marks'         => 1,
                'answers'       => ['x'],
            ])->json('data.id');
        }

        // Delete the middle question.
        $this->act()->deleteJson("/api/lecturer/question-banks/{$bank->id}/questions/{$ids[1]}")
            ->assertNoContent();

        $this->assertEquals(2, $bank->fresh()->total_questions);
        $remaining = $bank->questions()->orderBy('order_index')->pluck('order_index')->all();
        $this->assertEquals([1, 2], $remaining);
    }

    // ── Submission ──────────────────────────────────────────────────────────

    public function test_cannot_submit_empty_bank(): void
    {
        $bank = $this->createBank();

        $this->act()->postJson("/api/lecturer/question-banks/{$bank->id}/submit")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('questions');
    }

    public function test_can_submit_bank_with_questions(): void
    {
        $bank = $this->createBank();
        $this->act()->postJson("/api/lecturer/question-banks/{$bank->id}/questions", [
            'question_text' => 'Q?',
            'question_type' => 'fill_blank',
            'marks'         => 1,
            'answers'       => ['x'],
        ]);

        $this->act()->postJson("/api/lecturer/question-banks/{$bank->id}/submit")
            ->assertOk()
            ->assertJsonPath('data.status', 'submitted');

        $this->assertNotNull($bank->fresh()->submitted_at);
    }

    public function test_cannot_edit_submitted_bank(): void
    {
        $bank = $this->createBank();
        $bank->update(['status' => QuestionBankStatus::Submitted->value]);

        $this->act()->postJson("/api/lecturer/question-banks/{$bank->id}/questions", [
            'question_text' => 'Q?',
            'question_type' => 'fill_blank',
            'marks'         => 1,
            'answers'       => ['x'],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');
    }

    public function test_rejected_bank_is_editable_again(): void
    {
        $bank = $this->createBank();
        $bank->update(['status' => QuestionBankStatus::Rejected->value]);

        $this->act()->postJson("/api/lecturer/question-banks/{$bank->id}/questions", [
            'question_text' => 'Fixed question?',
            'question_type' => 'fill_blank',
            'marks'         => 1,
            'answers'       => ['x'],
        ])
            ->assertCreated();
    }

    public function test_can_delete_draft_bank(): void
    {
        $bank = $this->createBank();

        $this->act()->deleteJson("/api/lecturer/question-banks/{$bank->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('question_banks', ['id' => $bank->id]);
    }

    public function test_cannot_delete_submitted_bank(): void
    {
        $bank = $this->createBank();
        $bank->update(['status' => QuestionBankStatus::Submitted->value]);

        $this->act()->deleteJson("/api/lecturer/question-banks/{$bank->id}")
            ->assertUnprocessable();
    }
}
