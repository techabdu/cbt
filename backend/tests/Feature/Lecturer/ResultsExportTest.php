<?php

namespace Tests\Feature\Lecturer;

use App\Enums\ExamStatus;
use App\Enums\UserRole;
use App\Models\College;
use App\Models\Course;
use App\Models\Department;
use App\Models\Exam;
use App\Models\ExamResult;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ResultsExportTest extends TestCase
{
    use RefreshDatabase;

    private function makeExamWithResult(): Exam
    {
        College::factory()->create();
        $school   = School::factory()->create();
        $dept     = Department::factory()->create(['school_id' => $school->id]);
        $this->lecturer = User::factory()->role(UserRole::Lecturer)->create(['school_id' => $school->id, 'department_id' => $dept->id]);
        // A known course code so the exported filename is predictable.
        $course = Course::factory()->create(['school_id' => $school->id, 'department_id' => $dept->id, 'code' => 'CSC101']);
        $course->lecturers()->attach($this->lecturer->id, ['session' => '2024/2025', 'semester' => 'first']);

        // Session "2024/2025" contains a slash — the regression this guards.
        $exam = Exam::factory()->status(ExamStatus::ResultsSynced)->create(['course_id' => $course->id, 'session' => '2024/2025']);

        $student = Student::factory()->create(['school_id' => $school->id]);
        ExamResult::create([
            'exam_id' => $exam->id, 'student_id' => $student->id,
            'total_score' => 7, 'total_marks' => 10, 'percentage' => 70, 'grade' => 'A', 'is_absent' => false,
        ]);

        return $exam;
    }

    private User $lecturer;

    public function test_lecturer_can_export_results_as_pdf(): void
    {
        $exam = $this->makeExamWithResult();

        $response = $this->actingAs($this->lecturer, 'sanctum')
            ->get("/api/lecturer/results/{$exam->id}/export/pdf")
            ->assertOk();

        $disposition = $response->headers->get('content-disposition');
        $this->assertStringContainsString('csc101-results-2024-2025.pdf', $disposition);
        $this->assertStringNotContainsString('/', explode('filename=', $disposition)[1] ?? '');
    }

    public function test_lecturer_can_export_results_as_excel(): void
    {
        $exam = $this->makeExamWithResult();

        $response = $this->actingAs($this->lecturer, 'sanctum')
            ->get("/api/lecturer/results/{$exam->id}/export/excel")
            ->assertOk();

        $disposition = $response->headers->get('content-disposition');
        $this->assertStringContainsString('csc101-results-2024-2025.xlsx', $disposition);
    }
}
