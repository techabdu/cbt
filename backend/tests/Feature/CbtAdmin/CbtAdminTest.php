<?php

namespace Tests\Feature\CbtAdmin;

use App\Enums\ExamStatus;
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
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CbtAdminTest extends TestCase
{
    use RefreshDatabase;

    private User       $admin;
    private School     $school;
    private Department $dept;
    private Course     $course;

    protected function setUp(): void
    {
        parent::setUp();

        College::factory()->create();
        $this->school = School::factory()->create();
        $this->dept   = Department::factory()->create(['school_id' => $this->school->id]);
        $this->course = Course::factory()->create(['school_id' => $this->school->id, 'department_id' => $this->dept->id]);
        $this->admin  = User::factory()->role(UserRole::CbtAdmin)->create();
    }

    private function act(): static
    {
        $this->actingAs($this->admin, 'sanctum');
        return $this;
    }

    private function approvedBank(): QuestionBank
    {
        $lecturer = User::factory()->role(UserRole::Lecturer)->create(['school_id' => $this->school->id]);

        return QuestionBank::factory()->status(QuestionBankStatus::Approved)->create([
            'lecturer_id' => $lecturer->id,
            'course_id'   => $this->course->id,
            'session'     => '2024/2025',
            'semester'    => 'first',
            'total_questions' => 10,
            'reviewed_at' => now(),
        ]);
    }

    private function enrollStudents(int $count): void
    {
        Student::factory()->count($count)
            ->create(['school_id' => $this->school->id, 'department_id' => $this->dept->id])
            ->each(fn (Student $s) => $s->courses()->attach($this->course->id, [
                'session' => '2024/2025', 'semester' => 'first',
            ]));
    }

    // ── Access ──────────────────────────────────────────────────────────────

    public function test_exam_officer_cannot_access_cbt_admin_routes(): void
    {
        $this->actingAs(User::factory()->role(UserRole::ExamOfficer)->create(['school_id' => $this->school->id]), 'sanctum')
            ->getJson('/api/cbt-admin/exams')
            ->assertForbidden();
    }

    // ── Approved banks ──────────────────────────────────────────────────────

    public function test_only_approved_banks_are_listed(): void
    {
        $this->approvedBank();
        QuestionBank::factory()->status(QuestionBankStatus::Submitted)->create([
            'lecturer_id' => User::factory()->role(UserRole::Lecturer)->create()->id,
            'course_id'   => $this->course->id,
        ]);

        $this->act()->getJson('/api/cbt-admin/question-banks')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', 'approved');
    }

    // ── Exam configuration ──────────────────────────────────────────────────

    public function test_can_configure_exam_from_approved_bank(): void
    {
        $bank = $this->approvedBank();

        $this->act()->postJson('/api/cbt-admin/exams', [
            'question_bank_id' => $bank->id,
            'exam_date'        => now()->addWeek()->toDateString(),
            'start_time'       => '09:00',
            'duration_minutes' => 90,
        ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'scheduled')
            ->assertJsonPath('data.session', '2024/2025')
            ->assertJsonPath('data.duration_minutes', 90);

        $this->assertDatabaseHas('exams', ['question_bank_id' => $bank->id, 'course_id' => $this->course->id]);
    }

    public function test_cannot_configure_exam_from_unapproved_bank(): void
    {
        $bank = QuestionBank::factory()->status(QuestionBankStatus::Submitted)->create([
            'lecturer_id' => User::factory()->role(UserRole::Lecturer)->create()->id,
            'course_id'   => $this->course->id,
        ]);

        $this->act()->postJson('/api/cbt-admin/exams', [
            'question_bank_id' => $bank->id,
            'exam_date'        => now()->addWeek()->toDateString(),
            'start_time'       => '09:00',
            'duration_minutes' => 90,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('question_bank_id');
    }

    public function test_exam_date_cannot_be_in_the_past(): void
    {
        $bank = $this->approvedBank();

        $this->act()->postJson('/api/cbt-admin/exams', [
            'question_bank_id' => $bank->id,
            'exam_date'        => now()->subDay()->toDateString(),
            'start_time'       => '09:00',
            'duration_minutes' => 90,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('exam_date');
    }

    public function test_can_update_scheduled_exam(): void
    {
        $bank = $this->approvedBank();
        $exam = Exam::factory()->create(['course_id' => $this->course->id, 'question_bank_id' => $bank->id]);

        $this->act()->putJson("/api/cbt-admin/exams/{$exam->id}", [
            'exam_date'        => now()->addWeeks(2)->toDateString(),
            'start_time'       => '14:30',
            'duration_minutes' => 120,
        ])
            ->assertOk()
            ->assertJsonPath('data.duration_minutes', 120);
    }

    public function test_cannot_update_synced_exam(): void
    {
        $bank = $this->approvedBank();
        $exam = Exam::factory()->status(ExamStatus::Synced)->create([
            'course_id' => $this->course->id, 'question_bank_id' => $bank->id,
        ]);

        $this->act()->putJson("/api/cbt-admin/exams/{$exam->id}", [
            'exam_date'        => now()->addWeeks(2)->toDateString(),
            'start_time'       => '14:30',
            'duration_minutes' => 120,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');
    }

    public function test_can_delete_scheduled_exam(): void
    {
        $bank = $this->approvedBank();
        $exam = Exam::factory()->create(['course_id' => $this->course->id, 'question_bank_id' => $bank->id]);

        $this->act()->deleteJson("/api/cbt-admin/exams/{$exam->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('exams', ['id' => $exam->id]);
    }

    public function test_exam_show_includes_eligible_student_count(): void
    {
        $bank = $this->approvedBank();
        $exam = Exam::factory()->create([
            'course_id' => $this->course->id, 'question_bank_id' => $bank->id,
            'session' => '2024/2025', 'semester' => 'first',
        ]);
        $this->enrollStudents(4);

        $this->act()->getJson("/api/cbt-admin/exams/{$exam->id}")
            ->assertOk()
            ->assertJsonPath('data.eligible_count', 4);
    }

    // ── Exam codes ──────────────────────────────────────────────────────────

    public function test_generates_one_code_per_enrolled_student(): void
    {
        $bank = $this->approvedBank();
        $exam = Exam::factory()->create([
            'course_id' => $this->course->id, 'question_bank_id' => $bank->id,
            'session' => '2024/2025', 'semester' => 'first',
        ]);
        $this->enrollStudents(5);

        $this->act()->postJson("/api/cbt-admin/exams/{$exam->id}/codes/generate")
            ->assertOk()
            ->assertJsonPath('created', 5)
            ->assertJsonPath('total_codes', 5);

        $this->assertEquals(5, $exam->codes()->count());
        // Codes are 8 chars and unique.
        $codes = $exam->codes()->pluck('code');
        $this->assertCount(5, $codes->unique());
        $codes->each(fn ($c) => $this->assertEquals(8, strlen($c)));
    }

    public function test_generating_codes_twice_is_idempotent(): void
    {
        $bank = $this->approvedBank();
        $exam = Exam::factory()->create([
            'course_id' => $this->course->id, 'question_bank_id' => $bank->id,
            'session' => '2024/2025', 'semester' => 'first',
        ]);
        $this->enrollStudents(3);

        $this->act()->postJson("/api/cbt-admin/exams/{$exam->id}/codes/generate")->assertOk();
        $this->act()->postJson("/api/cbt-admin/exams/{$exam->id}/codes/generate")
            ->assertOk()
            ->assertJsonPath('created', 0)
            ->assertJsonPath('total_codes', 3);
    }

    public function test_can_list_codes_for_exam(): void
    {
        $bank = $this->approvedBank();
        $exam = Exam::factory()->create([
            'course_id' => $this->course->id, 'question_bank_id' => $bank->id,
            'session' => '2024/2025', 'semester' => 'first',
        ]);
        $this->enrollStudents(2);
        $this->act()->postJson("/api/cbt-admin/exams/{$exam->id}/codes/generate");

        $this->act()->getJson("/api/cbt-admin/exams/{$exam->id}/codes")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonStructure(['data' => [['code', 'student' => ['matric_number', 'full_name']]]]);
    }

    // ── Role management ─────────────────────────────────────────────────────

    public function test_can_promote_lecturer_to_exam_officer(): void
    {
        $lecturer = User::factory()->role(UserRole::Lecturer)->create(['school_id' => $this->school->id]);

        $this->act()->postJson("/api/cbt-admin/role-management/{$lecturer->id}/promote", [
            'reason' => 'Experienced staff member.',
        ])
            ->assertOk()
            ->assertJsonPath('data.role', 'exam_officer');

        $this->assertEquals(UserRole::ExamOfficer, $lecturer->fresh()->role);
        $this->assertDatabaseHas('role_upgrades', [
            'user_id' => $lecturer->id, 'from_role' => 'lecturer', 'to_role' => 'exam_officer',
        ]);
    }

    public function test_cannot_promote_lecturer_without_a_school(): void
    {
        $lecturer = User::factory()->role(UserRole::Lecturer)->create(['school_id' => null]);

        $this->act()->postJson("/api/cbt-admin/role-management/{$lecturer->id}/promote")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('role');
    }

    public function test_can_demote_exam_officer_to_lecturer(): void
    {
        $officer = User::factory()->role(UserRole::ExamOfficer)->create(['school_id' => $this->school->id]);

        $this->act()->postJson("/api/cbt-admin/role-management/{$officer->id}/demote")
            ->assertOk()
            ->assertJsonPath('data.role', 'lecturer');

        $this->assertEquals(UserRole::Lecturer, $officer->fresh()->role);
    }

    public function test_cannot_promote_a_cbt_admin(): void
    {
        $other = User::factory()->role(UserRole::CbtAdmin)->create();

        $this->act()->postJson("/api/cbt-admin/role-management/{$other->id}/promote")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('role');
    }

    public function test_role_management_lists_only_lecturers_and_officers(): void
    {
        User::factory()->role(UserRole::Lecturer)->create(['school_id' => $this->school->id]);
        User::factory()->role(UserRole::ExamOfficer)->create(['school_id' => $this->school->id]);
        // Another CBT admin should be excluded.
        User::factory()->role(UserRole::CbtAdmin)->create();

        $this->act()->getJson('/api/cbt-admin/role-management')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_role_change_is_recorded_in_history(): void
    {
        $lecturer = User::factory()->role(UserRole::Lecturer)->create(['school_id' => $this->school->id]);
        $this->act()->postJson("/api/cbt-admin/role-management/{$lecturer->id}/promote", ['reason' => 'x']);

        $this->act()->getJson('/api/cbt-admin/role-management/history')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.to_role', 'exam_officer');
    }

    public function test_stats_endpoint_returns_counts(): void
    {
        $this->approvedBank();

        $this->act()->getJson('/api/cbt-admin/stats')
            ->assertOk()
            ->assertJsonStructure(['approved_banks', 'scheduled_exams', 'total_exams', 'codes_generated', 'exam_officers']);
    }
}
