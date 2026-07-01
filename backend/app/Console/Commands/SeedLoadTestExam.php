<?php

namespace App\Console\Commands;

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
 * full enrolment graph. It uses plain DB inserts (no model factories / Faker) so
 * it also runs inside the production image, which is built with
 * `composer install --no-dev`. Each run uses a fresh random prefix, so it is
 * safe to run repeatedly.
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

        $prefix = 'LT'.strtoupper(Str::random(4)); // unique per run; ≤ 12-char codes
        $now = now();
        $this->info("Seeding load-test exam (prefix {$prefix}) ...");

        // ── Singletons (plain inserts; reuse the existing college if present) ───
        $collegeId = DB::table('colleges')->value('id')
            ?? DB::table('colleges')->insertGetId(['name' => 'Load Test College', 'created_at' => $now, 'updated_at' => $now]);

        $schoolId = DB::table('schools')->insertGetId([
            'college_id' => $collegeId, 'name' => "Load Test School {$prefix}", 'code' => $prefix,
            'created_at' => $now, 'updated_at' => $now,
        ]);

        $departmentId = DB::table('departments')->insertGetId([
            'school_id' => $schoolId, 'name' => "Load Test Dept {$prefix}", 'code' => $prefix.'D',
            'created_at' => $now, 'updated_at' => $now,
        ]);

        $lecturerId = DB::table('users')->insertGetId([
            'file_number' => 'LT/'.$prefix, 'name' => 'Load Test Lecturer',
            'email' => strtolower($prefix).'@loadtest.local', 'password' => bcrypt('password'),
            'role' => 'lecturer', 'school_id' => $schoolId, 'department_id' => $departmentId,
            'is_active' => true, 'force_password_change' => false, 'created_at' => $now, 'updated_at' => $now,
        ]);

        $courseId = DB::table('courses')->insertGetId([
            'school_id' => $schoolId, 'department_id' => $departmentId, 'title' => 'Load Test Course',
            'code' => $prefix.'C', 'credit_units' => 2, 'level' => 'NCE_100', 'semester' => 'first',
            'created_at' => $now, 'updated_at' => $now,
        ]);

        $bankId = DB::table('question_banks')->insertGetId([
            'lecturer_id' => $lecturerId, 'course_id' => $courseId, 'title' => 'Load Test Bank',
            'session' => '2024/2025', 'semester' => 'first', 'total_questions' => $questionCount,
            'status' => 'approved', 'created_at' => $now, 'updated_at' => $now,
        ]);

        $this->createQuestions($bankId, $questionCount, $now);

        $examId = DB::table('exams')->insertGetId([
            'course_id' => $courseId, 'question_bank_id' => $bankId, 'session' => '2024/2025',
            'semester' => 'first', 'exam_date' => $now->toDateString(), 'start_time' => '09:00:00',
            'duration_minutes' => $duration, 'status' => 'scheduled', 'created_at' => $now, 'updated_at' => $now,
        ]);

        // ── Students + codes (bulk) ────────────────────────────────────────────
        $this->bulkInsertStudents($prefix, $students, $schoolId, $departmentId, $now);

        $idByMatric = DB::table('students')
            ->where('matric_number', 'like', $prefix.'/%')
            ->pluck('id', 'matric_number');

        $credentials = $this->bulkInsertCodes($prefix, $examId, $idByMatric, $now);

        // ── Export ─────────────────────────────────────────────────────────────
        @mkdir(dirname($output), 0777, true);
        file_put_contents($output, json_encode([
            'base_hint' => 'POST {BASE_URL}/api/student/exam/login with {matric_number, exam_code}',
            'exam_id' => $examId,
            'count' => count($credentials),
            'credentials' => $credentials,
        ], JSON_PRETTY_PRINT));

        $this->newLine();
        $this->info('Done.');
        $this->table(['exam_id', 'students', 'questions', 'duration_min', 'credentials file'], [[
            $examId, count($credentials), $questionCount, $duration, $output,
        ]]);
        $this->line('Run the load test with:  k6 run -e CREDENTIALS=credentials.json scripts/loadtest/exam-spike.js');

        return self::SUCCESS;
    }

    /**
     * A small mix of MCQ / True-False / Fill-blank questions with options/answers.
     */
    private function createQuestions(int $bankId, int $count, \DateTimeInterface $now): void
    {
        $options = [];
        $answers = [];

        $this->withProgressBar(range(1, $count), function (int $i) use ($bankId, $now, &$options, &$answers): void {
            $type = ['mcq', 'true_false', 'fill_blank'][$i % 3];

            $questionId = DB::table('questions')->insertGetId([
                'question_bank_id' => $bankId,
                'question_text' => "Load-test question {$i}?",
                'question_type' => $type,
                'marks' => 1,
                'order_index' => $i,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            if ($type === 'fill_blank') {
                $answers[] = ['question_id' => $questionId, 'correct_answer' => 'answer', 'created_at' => $now, 'updated_at' => $now];
            } elseif ($type === 'true_false') {
                $options[] = ['question_id' => $questionId, 'option_label' => 'T', 'option_text' => 'True', 'is_correct' => true, 'created_at' => $now, 'updated_at' => $now];
                $options[] = ['question_id' => $questionId, 'option_label' => 'F', 'option_text' => 'False', 'is_correct' => false, 'created_at' => $now, 'updated_at' => $now];
            } else {
                foreach (['A' => true, 'B' => false, 'C' => false, 'D' => false] as $label => $correct) {
                    $options[] = ['question_id' => $questionId, 'option_label' => $label, 'option_text' => "Option {$label}", 'is_correct' => $correct, 'created_at' => $now, 'updated_at' => $now];
                }
            }
        });

        foreach (array_chunk($options, 1000) as $chunk) {
            DB::table('question_options')->insert($chunk);
        }
        if ($answers) {
            DB::table('question_answers')->insert($answers);
        }
        $this->newLine();
    }

    private function bulkInsertStudents(string $prefix, int $count, int $schoolId, int $departmentId, \DateTimeInterface $now): void
    {
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
    private function bulkInsertCodes(string $prefix, int $examId, $idByMatric, \DateTimeInterface $now): array
    {
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
