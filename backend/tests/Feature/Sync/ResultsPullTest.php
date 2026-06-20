<?php

namespace Tests\Feature\Sync;

use App\Enums\ExamStatus;
use App\Enums\QuestionBankStatus;
use App\Enums\UserRole;
use App\Models\College;
use App\Models\Course;
use App\Models\Department;
use App\Models\Exam;
use App\Models\ExamCode; // direct create (no factory)
use App\Models\ExamResult;
use App\Models\ExamSession;
use App\Models\QuestionBank;
use App\Models\School;
use App\Models\Student;
use App\Models\StudentAnswer;
use App\Models\User;
use App\Notifications\ExamResultsAvailable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class ResultsPullTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private Exam $exam;
    private User $lecturer;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'cbt.offline_server_url' => 'http://192.168.1.10',
            'cbt.sync_secret_key'    => 'test-secret',
        ]);

        [$this->admin, $this->exam, $this->lecturer] = $this->scaffold();
    }

    /** @return array{User, Exam, User} */
    private function scaffold(): array
    {
        College::factory()->create();
        $school   = School::factory()->create();
        $dept     = Department::factory()->create(['school_id' => $school->id]);
        $lecturer = User::factory()->role(UserRole::Lecturer)->create(['school_id' => $school->id]);
        $admin    = User::factory()->role(UserRole::CbtAdmin)->create();
        $course   = Course::factory()->create(['school_id' => $school->id, 'department_id' => $dept->id]);
        $lecturer->lecturerCourses()->create(['course_id' => $course->id, 'session' => '2024/2025', 'semester' => 'first']);
        $bank = QuestionBank::factory()->status(QuestionBankStatus::Approved)->create([
            'lecturer_id' => $lecturer->id, 'course_id' => $course->id,
            'session' => '2024/2025', 'semester' => 'first',
        ]);
        $q = $bank->questions()->create(['question_text' => 'Q1', 'question_type' => 'mcq', 'marks' => 2, 'order_index' => 1]);
        $q->options()->createMany([
            ['option_label' => 'A', 'option_text' => 'Correct', 'is_correct' => true],
            ['option_label' => 'B', 'option_text' => 'Wrong', 'is_correct' => false],
        ]);
        $bank->update(['total_questions' => 1]);

        $student = Student::factory()->create(['school_id' => $school->id, 'department_id' => $dept->id]);
        $exam = Exam::factory()->create([
            'course_id'        => $course->id,
            'question_bank_id' => $bank->id,
            'status'           => ExamStatus::Synced,
            'configured_by'    => $admin->id,
        ]);
        ExamCode::create(['exam_id' => $exam->id, 'student_id' => $student->id, 'code' => 'TESTCODE', 'is_used' => true]);

        return [$admin, $exam, $lecturer];
    }

    private function fakeOfflinePayload(): array
    {
        $student = $this->exam->codes()->first()->student;
        $session = ['id' => 1, 'exam_id' => $this->exam->id, 'student_id' => $student->id,
            'started_at' => now()->subHour()->toIso8601String(),
            'submitted_at' => now()->toIso8601String(),
            'is_auto_submitted' => false,
            'answers' => [
                ['id' => 1, 'exam_session_id' => 1, 'question_id' => $this->exam->questionBank->questions->first()->id,
                 'student_answer' => 'A', 'is_correct' => true, 'marks_earned' => 2.0, 'order_index' => 0],
            ],
        ];
        $result = ['id' => 1, 'exam_id' => $this->exam->id, 'student_id' => $student->id,
            'total_score' => 2.0, 'total_marks' => 2.0, 'percentage' => 100.0, 'grade' => 'A', 'is_absent' => false];

        return ['exam_id' => $this->exam->id, 'sessions' => [$session], 'results' => [$result]];
    }

    public function test_pull_results_inserts_sessions_and_marks_exam_results_synced(): void
    {
        Http::fake(['*' => Http::response($this->fakeOfflinePayload(), 200)]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/cbt-admin/exams/{$this->exam->id}/pull-results")
            ->assertOk()
            ->assertJsonPath('exam.status', 'results_synced');

        $this->assertDatabaseHas('exam_sessions', ['exam_id' => $this->exam->id]);
        $this->assertDatabaseHas('exam_results', ['exam_id' => $this->exam->id, 'grade' => 'A']);
        $this->assertEquals(ExamStatus::ResultsSynced, $this->exam->fresh()->status);
    }

    public function test_pull_sends_notification_to_lecturer(): void
    {
        Notification::fake();
        Http::fake(['*' => Http::response($this->fakeOfflinePayload(), 200)]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/cbt-admin/exams/{$this->exam->id}/pull-results")
            ->assertOk();

        Notification::assertSentTo($this->lecturer, ExamResultsAvailable::class);
    }

    public function test_pull_logs_to_sync_log(): void
    {
        Http::fake(['*' => Http::response($this->fakeOfflinePayload(), 200)]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/cbt-admin/exams/{$this->exam->id}/pull-results")
            ->assertOk();

        $this->assertDatabaseHas('sync_logs', ['exam_id' => $this->exam->id, 'direction' => 'pull', 'status' => 'success']);
    }

    public function test_pull_returns_502_when_offline_server_unreachable(): void
    {
        Http::fake(['*' => Http::response(null, 500)]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/cbt-admin/exams/{$this->exam->id}/pull-results")
            ->assertStatus(502);

        $this->assertDatabaseHas('sync_logs', ['direction' => 'pull', 'status' => 'failed']);
    }

    public function test_offline_server_exposes_results_via_sync_route(): void
    {
        $student = $this->exam->codes()->first()->student;
        $session = ExamSession::create([
            'exam_id' => $this->exam->id, 'student_id' => $student->id,
            'started_at' => now()->subHour(), 'submitted_at' => now(), 'is_auto_submitted' => false,
        ]);
        StudentAnswer::create([
            'exam_session_id' => $session->id, 'question_id' => $this->exam->questionBank->questions->first()->id,
            'student_answer' => 'A', 'is_correct' => true, 'marks_earned' => 2, 'order_index' => 0,
        ]);
        ExamResult::create([
            'exam_id' => $this->exam->id, 'student_id' => $student->id,
            'total_score' => 2, 'total_marks' => 2, 'percentage' => 100, 'grade' => 'A',
        ]);

        $this->withHeaders(['X-Sync-Secret' => 'test-secret'])
            ->getJson("/api/sync/results/{$this->exam->id}")
            ->assertOk()
            ->assertJsonPath('exam_id', $this->exam->id)
            ->assertJsonCount(1, 'sessions')
            ->assertJsonCount(1, 'results')
            ->assertJsonPath('results.0.grade', 'A');
    }

    public function test_lecturer_can_list_exams_with_results(): void
    {
        $this->exam->update(['status' => ExamStatus::ResultsSynced]);

        $this->actingAs($this->lecturer, 'sanctum')
            ->getJson('/api/lecturer/results')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_lecturer_can_view_result_detail(): void
    {
        $student = $this->exam->codes()->first()->student;
        ExamResult::create([
            'exam_id' => $this->exam->id, 'student_id' => $student->id,
            'total_score' => 1.5, 'total_marks' => 2, 'percentage' => 75, 'grade' => 'B',
        ]);
        $this->exam->update(['status' => ExamStatus::ResultsSynced]);

        $this->actingAs($this->lecturer, 'sanctum')
            ->getJson("/api/lecturer/results/{$this->exam->id}")
            ->assertOk()
            ->assertJsonPath('results.0.grade', 'B');
    }

    public function test_lecturer_cannot_view_another_lecturers_exam_results(): void
    {
        $other = User::factory()->role(UserRole::Lecturer)->create();
        $this->exam->update(['status' => ExamStatus::ResultsSynced]);

        $this->actingAs($other, 'sanctum')
            ->getJson("/api/lecturer/results/{$this->exam->id}")
            ->assertForbidden();
    }
}
