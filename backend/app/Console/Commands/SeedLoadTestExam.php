<?php

namespace App\Console\Commands;

use App\Enums\QuestionBankStatus;
use App\Enums\UserRole;
use App\Models\College;
use App\Models\Course;
use App\Models\Department;
use App\Models\Exam;
use App\Models\QuestionBank;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Builds a self-contained exam with N students + exam codes purely for load
 * testing the student exam flow, and writes the {matric_number, exam_code}
 * pairs to a JSON file the k6 script consumes (scripts/loadtest/).
 *
 * Logging in only needs a matching exam_code + student matric, so this skips the
 * full enrolment graph and bulk-inserts students and codes for speed. Each run
 * uses a fresh random prefix, so it is safe to run repeatedly.
 */
class SeedLoadTestExam extends Command
{
    protected $signature = 'loadtest:seed-exam
        {--students=5000 : Number of students + exam codes to create}
        {--questions=40 : Number of questions in the bank}
        {--duration=600 : Exam duration in minutes (long, so the timer never expires mid-test)}
        {--output= : Where to write the credentials JSON (default: scripts/loadtest/credentials.json)}
        {--force : Skip the confirmation prompt}';

    protected $description = 'Seed a throwaway exam + students + codes and export login credentials for the k6 load test';

    public function handle(): int
    {
        $students = max(1, (int) $this->option('students'));
        $questionCount = max(1, (int) $this->option('questions'));
        $duration = max(1, (int) $this->option('duration'));
        $output = $this->option('output') ?: base_path('../scripts/loadtest/credentials.json');

        if (! $this->option('force') && $this->input->isInteractive()
            && ! $this->confirm("Create a load-test exam with {$students} students + codes?")) {
            $this->warn('Aborted.');

            return self::FAILURE;
        }

        $prefix = 'LT'.strtoupper(Str::random(4)); // unique per run, ≤ 12-char codes
        $this->info("Seeding load-test exam (prefix {$prefix}) ...");

        // ── Singletons (cheap) ─────────────────────────────────────────────────
        $college = College::query()->first() ?? College::factory()->create();
        $school = School::factory()->create(['college_id' => $college->id]);
        $department = Department::factory()->create(['school_id' => $school->id]);
        $lecturer = User::factory()->role(UserRole::Lecturer)->create(['school_id' => $school->id]);
        $course = Course::factory()->create(['school_id' => $school->id, 'department_id' => $department->id]);

        $bank = QuestionBank::factory()->status(QuestionBankStatus::Approved)->create([
            'lecturer_id' => $lecturer->id,
            'course_id' => $course->id,
            'session' => '2024/2025',
            'semester' => 'first',
            'total_questions' => $questionCount,
        ]);

        $this->createQuestions($bank, $questionCount);

        $exam = Exam::factory()->create([
            'course_id' => $course->id,
            'question_bank_id' => $bank->id,
            'session' => '2024/2025',
            'semester' => 'first',
            'duration_minutes' => $duration,
        ]);

        // ── Students + codes (bulk) ────────────────────────────────────────────
        $this->bulkInsertStudents($prefix, $students, $school->id, $department->id);

        $idByMatric = Student::query()
            ->where('matric_number', 'like', $prefix.'/%')
            ->pluck('id', 'matric_number');

        $credentials = $this->bulkInsertCodes($prefix, $exam->id, $idByMatric);

        // ── Export ─────────────────────────────────────────────────────────────
        @mkdir(dirname($output), 0777, true);
        file_put_contents($output, json_encode([
            'base_hint' => 'POST {BASE_URL}/api/student/exam/login with {matric_number, exam_code}',
            'exam_id' => $exam->id,
            'count' => count($credentials),
            'credentials' => $credentials,
        ], JSON_PRETTY_PRINT));

        $this->newLine();
        $this->info('Done.');
        $this->table(['exam_id', 'students', 'questions', 'duration_min', 'credentials file'], [[
            $exam->id, count($credentials), $questionCount, $duration, $output,
        ]]);
        $this->line('Run the load test with:  k6 run -e CREDENTIALS=credentials.json scripts/loadtest/exam-spike.js');

        return self::SUCCESS;
    }

    /**
     * A small mix of MCQ / True-False / Fill-blank questions with options/answers.
     */
    private function createQuestions(QuestionBank $bank, int $count): void
    {
        $this->withProgressBar(range(1, $count), function (int $i) use ($bank): void {
            $type = ['mcq', 'true_false', 'fill_blank'][$i % 3];

            $q = $bank->questions()->create([
                'question_text' => "Load-test question {$i}?",
                'question_type' => $type,
                'marks' => 1,
                'order_index' => $i,
            ]);

            if ($type === 'fill_blank') {
                $q->answers()->create(['correct_answer' => 'answer']);
            } elseif ($type === 'true_false') {
                $q->options()->createMany([
                    ['option_label' => 'T', 'option_text' => 'True', 'is_correct' => true],
                    ['option_label' => 'F', 'option_text' => 'False', 'is_correct' => false],
                ]);
            } else {
                $q->options()->createMany([
                    ['option_label' => 'A', 'option_text' => 'Option A', 'is_correct' => true],
                    ['option_label' => 'B', 'option_text' => 'Option B', 'is_correct' => false],
                    ['option_label' => 'C', 'option_text' => 'Option C', 'is_correct' => false],
                    ['option_label' => 'D', 'option_text' => 'Option D', 'is_correct' => false],
                ]);
            }
        });
        $this->newLine();
    }

    private function bulkInsertStudents(string $prefix, int $count, int $schoolId, int $departmentId): void
    {
        $now = now();
        foreach (array_chunk(range(1, $count), 1000) as $chunk) {
            $rows = array_map(fn (int $i) => [
                'matric_number' => sprintf('%s/%05d', $prefix, $i),
                'full_name' => "Load Test Student {$i}",
                'school_id' => $schoolId,
                'department_id' => $departmentId,
                'level' => 'NCE_100',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ], $chunk);

            DB::table('students')->insert($rows);
        }
    }

    /**
     * @param  Collection<string, int>  $idByMatric
     * @return array<int, array{matric_number: string, exam_code: string}>
     */
    private function bulkInsertCodes(string $prefix, int $examId, $idByMatric): array
    {
        $now = now();
        $credentials = [];
        $rows = [];
        $i = 0;

        foreach ($idByMatric as $matric => $studentId) {
            $i++;
            $code = sprintf('%s%05d', $prefix, $i); // ≤ 12 chars, globally unique this run
            $credentials[] = ['matric_number' => $matric, 'exam_code' => $code];
            $rows[] = [
                'exam_id' => $examId,
                'student_id' => $studentId,
                'code' => $code,
                'is_used' => false,
                'generated_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        foreach (array_chunk($rows, 1000) as $chunk) {
            DB::table('exam_codes')->insert($chunk);
        }

        return $credentials;
    }
}
