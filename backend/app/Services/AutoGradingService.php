<?php

namespace App\Services;

use App\Enums\QuestionType;
use App\Models\ExamResult;
use App\Models\ExamSession;
use App\Models\Question;
use Illuminate\Support\Facades\DB;

class AutoGradingService
{
    /**
     * Grade every answer in a submitted session, persist per-answer correctness
     * and marks, then upsert the aggregate ExamResult. Safe to re-run.
     */
    public function gradeSession(ExamSession $session): ExamResult
    {
        $exam = $session->exam()->with('questionBank.questions.options', 'questionBank.questions.answers')->first();
        $questions = $exam->questionBank->questions->keyBy('id');

        $answers = $session->answers()->get()->keyBy('question_id');

        $totalMarks = (float) $questions->sum('marks');
        $score = 0.0;

        DB::transaction(function () use ($questions, $answers, &$score) {
            foreach ($questions as $question) {
                /** @var \App\Models\StudentAnswer|null $answer */
                $answer = $answers->get($question->id);
                if (! $answer) {
                    continue; // unanswered → 0
                }

                $correct = $this->isCorrect($question, $answer->student_answer);
                $earned = $correct ? (float) $question->marks : 0.0;
                $score += $earned;

                $answer->update([
                    'is_correct'   => $correct,
                    'marks_earned' => $earned,
                ]);
            }
        });

        $percentage = $totalMarks > 0 ? round(($score / $totalMarks) * 100, 2) : 0.0;

        return ExamResult::updateOrCreate(
            ['exam_id' => $session->exam_id, 'student_id' => $session->student_id],
            [
                'total_score' => $score,
                'total_marks' => $totalMarks,
                'percentage'  => $percentage,
                'grade'       => $this->grade($percentage),
                'is_absent'   => false,
            ],
        );
    }

    /**
     * Decide whether a stored student answer is correct for its question.
     */
    public function isCorrect(Question $question, ?string $studentAnswer): bool
    {
        if ($studentAnswer === null || trim($studentAnswer) === '') {
            return false;
        }

        return match ($question->question_type) {
            QuestionType::Mcq, QuestionType::TrueFalse => $this->matchesOption($question, $studentAnswer),
            QuestionType::FillBlank                    => $this->matchesAnswer($question, $studentAnswer),
        };
    }

    /**
     * MCQ / True-False: the student stores the option label (e.g. "B" or "T").
     */
    private function matchesOption(Question $question, string $studentAnswer): bool
    {
        $correctLabel = $question->options->firstWhere('is_correct', true)?->option_label;

        return $correctLabel !== null
            && strcasecmp(trim($studentAnswer), $correctLabel) === 0;
    }

    /**
     * Fill-in-the-blank: case-insensitive, trimmed match against any variant.
     */
    private function matchesAnswer(Question $question, string $studentAnswer): bool
    {
        $needle = mb_strtolower(trim($studentAnswer));

        return $question->answers
            ->map(fn ($a) => mb_strtolower(trim($a->correct_answer)))
            ->contains($needle);
    }

    /**
     * Map a percentage to a letter grade using the configured thresholds.
     */
    public function grade(float $percentage): string
    {
        foreach (config('cbt.grade_thresholds') as $letter => $floor) {
            if ($percentage >= $floor) {
                return $letter;
            }
        }

        return 'F';
    }
}
