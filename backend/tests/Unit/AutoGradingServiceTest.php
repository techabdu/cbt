<?php

namespace Tests\Unit;

use App\Models\Question;
use App\Models\QuestionBank;
use App\Services\AutoGradingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AutoGradingServiceTest extends TestCase
{
    use RefreshDatabase;

    private AutoGradingService $grading;
    private QuestionBank $bank;

    protected function setUp(): void
    {
        parent::setUp();
        $this->grading = app(AutoGradingService::class);
        $this->bank = QuestionBank::factory()->create();
    }

    private function mcq(string $correctLabel = 'B'): Question
    {
        $q = $this->bank->questions()->create([
            'question_text' => 'Q', 'question_type' => 'mcq', 'marks' => 2, 'order_index' => 1,
        ]);
        foreach (['A' => 'one', 'B' => 'two', 'C' => 'three'] as $label => $text) {
            $q->options()->create(['option_label' => $label, 'option_text' => $text, 'is_correct' => $label === $correctLabel]);
        }
        return $q->load('options', 'answers');
    }

    private function trueFalse(bool $answer = true): Question
    {
        $q = $this->bank->questions()->create([
            'question_text' => 'TF', 'question_type' => 'true_false', 'marks' => 1, 'order_index' => 2,
        ]);
        $q->options()->create(['option_label' => 'T', 'option_text' => 'True', 'is_correct' => $answer]);
        $q->options()->create(['option_label' => 'F', 'option_text' => 'False', 'is_correct' => ! $answer]);
        return $q->load('options', 'answers');
    }

    private function fillBlank(array $answers = ['Paris']): Question
    {
        $q = $this->bank->questions()->create([
            'question_text' => 'FB', 'question_type' => 'fill_blank', 'marks' => 3, 'order_index' => 3,
        ]);
        foreach ($answers as $a) {
            $q->answers()->create(['correct_answer' => $a]);
        }
        return $q->load('options', 'answers');
    }

    public function test_mcq_correct_and_incorrect(): void
    {
        $q = $this->mcq('B');
        $this->assertTrue($this->grading->isCorrect($q, 'B'));
        $this->assertTrue($this->grading->isCorrect($q, 'b')); // case-insensitive label
        $this->assertFalse($this->grading->isCorrect($q, 'A'));
        $this->assertFalse($this->grading->isCorrect($q, null));
    }

    public function test_true_false(): void
    {
        $q = $this->trueFalse(true);
        $this->assertTrue($this->grading->isCorrect($q, 'T'));
        $this->assertFalse($this->grading->isCorrect($q, 'F'));
    }

    public function test_fill_blank_is_case_insensitive_and_trimmed(): void
    {
        $q = $this->fillBlank(['Paris', 'City of Light']);
        $this->assertTrue($this->grading->isCorrect($q, 'paris'));
        $this->assertTrue($this->grading->isCorrect($q, '  PARIS  '));
        $this->assertTrue($this->grading->isCorrect($q, 'city of light'));
        $this->assertFalse($this->grading->isCorrect($q, 'London'));
    }

    public function test_grade_thresholds(): void
    {
        $this->assertEquals('A', $this->grading->grade(85));
        $this->assertEquals('B', $this->grading->grade(65));
        $this->assertEquals('C', $this->grading->grade(50));
        $this->assertEquals('D', $this->grading->grade(45));
        $this->assertEquals('F', $this->grading->grade(20));
    }
}
