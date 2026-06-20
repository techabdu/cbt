<?php

namespace Tests\Feature\Sync;

use App\Enums\ExamStatus;
use App\Enums\QuestionBankStatus;
use App\Enums\UserRole;
use App\Models\College;
use App\Models\Course;
use App\Models\Department;
use App\Models\Exam;
use App\Models\ExamCode;
use App\Models\QuestionBank;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use App\Services\SyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SyncTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private Exam $exam;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'cbt.offline_server_url' => 'http://192.168.1.10',
            'cbt.sync_secret_key'    => 'test-secret',
        ]);

        $this->admin = User::factory()->role(UserRole::CbtAdmin)->create();
        $this->exam  = $this->buildExamWithCodes();
    }

    private function buildExamWithCodes(): Exam
    {
        College::factory()->create();
        $school   = School::factory()->create();
        $dept     = Department::factory()->create(['school_id' => $school->id]);
        $lecturer = User::factory()->role(UserRole::Lecturer)->create(['school_id' => $school->id]);
        $course   = Course::factory()->create(['school_id' => $school->id, 'department_id' => $dept->id]);

        $bank = QuestionBank::factory()->status(QuestionBankStatus::Approved)->create([
            'lecturer_id' => $lecturer->id, 'course_id' => $course->id,
            'session' => '2024/2025', 'semester' => 'first',
        ]);
        $q = $bank->questions()->create(['question_text' => 'Q1', 'question_type' => 'mcq', 'marks' => 1, 'order_index' => 1]);
        $q->options()->createMany([
            ['option_label' => 'A', 'option_text' => 'a', 'is_correct' => true],
            ['option_label' => 'B', 'option_text' => 'b', 'is_correct' => false],
        ]);
        $bank->update(['total_questions' => 1]);

        $exam = Exam::factory()->create([
            'course_id' => $course->id, 'question_bank_id' => $bank->id,
            'session' => '2024/2025', 'semester' => 'first',
        ]);

        Student::factory()->count(3)->create(['school_id' => $school->id, 'department_id' => $dept->id])
            ->each(function (Student $s, int $i) use ($exam) {
                $s->courses()->attach($exam->course_id, ['session' => '2024/2025', 'semester' => 'first']);
                ExamCode::create(['exam_id' => $exam->id, 'student_id' => $s->id, 'code' => 'CODE000'.$i, 'is_used' => false]);
            });

        return $exam;
    }

    // ── Push ──────────────────────────────────────────────────────────────────

    public function test_push_sends_payload_and_marks_exam_synced(): void
    {
        Http::fake(['*/api/sync/receive-exam' => Http::response(['received' => true], 200)]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/cbt-admin/exams/{$this->exam->id}/sync")
            ->assertOk()
            ->assertJsonPath('exam.status', 'synced');

        Http::assertSent(function ($request) {
            return str_contains($request->url(), '/api/sync/receive-exam')
                && $request->hasHeader('X-Sync-Secret', 'test-secret')
                && count($request['questions']) === 1
                && count($request['exam_codes']) === 3;
        });

        $this->assertEquals(ExamStatus::Synced, $this->exam->fresh()->status);
        $this->assertDatabaseHas('sync_logs', ['exam_id' => $this->exam->id, 'status' => 'success', 'direction' => 'push']);
    }

    public function test_push_requires_codes(): void
    {
        $bank = QuestionBank::factory()->status(QuestionBankStatus::Approved)->create([
            'lecturer_id' => User::factory()->role(UserRole::Lecturer)->create()->id,
        ]);
        $exam = Exam::factory()->create(['question_bank_id' => $bank->id, 'course_id' => $bank->course_id]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/cbt-admin/exams/{$exam->id}/sync")
            ->assertStatus(422);
    }

    public function test_push_failure_is_logged_and_returns_502(): void
    {
        Http::fake(['*/api/sync/receive-exam' => Http::response('boom', 500)]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/cbt-admin/exams/{$this->exam->id}/sync")
            ->assertStatus(502);

        $this->assertDatabaseHas('sync_logs', ['exam_id' => $this->exam->id, 'status' => 'failed']);
        $this->assertEquals(ExamStatus::Scheduled, $this->exam->fresh()->status);
    }

    public function test_sync_logs_are_listable(): void
    {
        Http::fake(['*' => Http::response(['received' => true], 200)]);
        $this->actingAs($this->admin, 'sanctum')->postJson("/api/cbt-admin/exams/{$this->exam->id}/sync");

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/cbt-admin/sync-logs')
            ->assertOk()
            ->assertJsonPath('data.0.status', 'success');
    }

    // ── Offline receive (round-trip ingestion) ─────────────────────────────────

    public function test_offline_receive_rebuilds_the_exam_graph(): void
    {
        // Build the payload the online server would send.
        $payload = app(SyncService::class)->buildExamPayload($this->exam);
        $examId  = $this->exam->id;

        // Simulate a *fresh* offline DB by wiping the domain tables.
        Schema::withoutForeignKeyConstraints(function (): void {
            foreach (['exam_codes', 'exams', 'question_answers', 'question_options', 'questions',
                      'question_banks', 'students', 'courses', 'departments', 'schools', 'colleges'] as $table) {
                \DB::table($table)->delete();
            }
            \DB::table('users')->whereIn('role', ['lecturer'])->delete();
        });

        $this->assertDatabaseCount('exams', 0);

        // The offline server receives the payload via the secret-authenticated route.
        $this->withHeaders(['X-Sync-Secret' => 'test-secret'])
            ->postJson('/api/sync/receive-exam', $payload)
            ->assertOk()
            ->assertJsonPath('received', true)
            ->assertJsonPath('codes', 3);

        // The full graph is restored with the same primary keys.
        $this->assertDatabaseHas('exams', ['id' => $examId, 'status' => 'synced']);
        $this->assertDatabaseCount('questions', 1);
        $this->assertDatabaseCount('question_options', 2);
        $this->assertDatabaseCount('exam_codes', 3);
        $this->assertDatabaseCount('students', 3);
    }

    public function test_receive_rejects_bad_secret(): void
    {
        $this->withHeaders(['X-Sync-Secret' => 'wrong'])
            ->postJson('/api/sync/receive-exam', [])
            ->assertUnauthorized();
    }
}
