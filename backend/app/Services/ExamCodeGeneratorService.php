<?php

namespace App\Services;

use App\Models\Exam;
use App\Models\ExamCode;
use App\Models\Student;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ExamCodeGeneratorService
{
    /**
     * Characters used for exam codes. Ambiguous glyphs (0/O, 1/I/L) are excluded
     * so codes can be read aloud and typed without confusion.
     */
    private const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    private const LENGTH = 8;

    public function __construct(
        private readonly AuditLogService $auditLog,
    ) {}

    /**
     * Generate one unique code per student enrolled in the exam's course for the
     * matching session + semester. Students that already have a code are skipped,
     * so this is safe to call repeatedly.
     *
     * @return int number of new codes created
     */
    public function generateForExam(Exam $exam, ?int $actorId = null, ?string $ip = null): int
    {
        $students = $this->eligibleStudents($exam);

        // Students that already hold a code for this exam.
        $existing = ExamCode::query()
            ->where('exam_id', $exam->id)
            ->pluck('student_id')
            ->all();

        $pending = $students->reject(fn (Student $s) => in_array($s->id, $existing, true));

        if ($pending->isEmpty()) {
            return 0;
        }

        $rows = $pending->map(fn (Student $student) => [
            'exam_id'      => $exam->id,
            'student_id'   => $student->id,
            'code'         => $this->uniqueCode(),
            'is_used'      => false,
            'generated_at' => now(),
            'created_at'   => now(),
            'updated_at'   => now(),
        ])->all();

        DB::transaction(fn () => ExamCode::insert($rows));

        $this->auditLog->log('exam_codes_generated', $actorId ? \App\Models\User::find($actorId) : null,
            Exam::class, $exam->id,
            newValues: ['count' => count($rows)],
            ipAddress: $ip);

        return count($rows);
    }

    /**
     * Students enrolled in the exam's course for its session + semester.
     *
     * @return Collection<int, Student>
     */
    public function eligibleStudents(Exam $exam): Collection
    {
        return Student::query()
            ->where('is_active', true)
            ->whereHas('courses', fn ($q) => $q
                ->where('courses.id', $exam->course_id)
                ->where('student_courses.session', $exam->session)
                ->where('student_courses.semester', $exam->semester->value))
            ->get();
    }

    /**
     * Produce a code that is not already present in exam_codes. Keeps a small
     * in-memory cache of codes minted in this call to avoid intra-batch clashes
     * before the rows are inserted.
     *
     * @var array<string, true>
     */
    private array $minted = [];

    private function uniqueCode(): string
    {
        do {
            $code = $this->randomCode();
        } while (isset($this->minted[$code]) || ExamCode::where('code', $code)->exists());

        $this->minted[$code] = true;

        return $code;
    }

    private function randomCode(): string
    {
        $alphabetLength = strlen(self::ALPHABET);
        $code = '';

        for ($i = 0; $i < self::LENGTH; $i++) {
            $code .= self::ALPHABET[random_int(0, $alphabetLength - 1)];
        }

        return $code;
    }
}
