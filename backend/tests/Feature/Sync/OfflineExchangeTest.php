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
use App\Models\ExamResult;
use App\Models\QuestionBank;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use App\Services\SyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class OfflineExchangeTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private Exam $exam;

    protected function setUp(): void
    {
        parent::setUp();

        config(['cbt.sync_secret_key' => 'test-secret']);

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
        $course->lecturers()->attach($lecturer->id, ['session' => '2024/2025', 'semester' => 'first']);

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
                ExamCode::create(['exam_id' => $exam->id, 'student_id' => $s->id, 'code' => 'CODE000'.$i, 'is_used' => false]);
            });

        return $exam;
    }

    private function wipeDomain(): void
    {
        Schema::withoutForeignKeyConstraints(function (): void {
            foreach (['exam_results', 'exam_sessions', 'exam_codes', 'exams', 'question_answers', 'question_options',
                      'questions', 'question_banks', 'students', 'courses', 'departments', 'schools', 'colleges'] as $table) {
                DB::table($table)->delete();
            }
            DB::table('users')->where('role', 'lecturer')->delete();
        });
    }

    // ── FILE transport ──────────────────────────────────────────────────────────

    public function test_export_package_downloads_json_and_marks_synced(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->get("/api/cbt-admin/exams/{$this->exam->id}/export-package")
            ->assertOk();

        $this->assertStringContainsString('attachment', (string) $response->headers->get('content-disposition'));
        $body = json_decode($response->getContent(), true);
        $this->assertSame($this->exam->id, $body['exam']['id']);
        $this->assertCount(3, $body['exam_codes']);
        $this->assertEquals(ExamStatus::Synced, $this->exam->fresh()->status);
    }

    public function test_export_package_requires_codes(): void
    {
        $this->exam->codes()->delete();

        $this->actingAs($this->admin, 'sanctum')
            ->get("/api/cbt-admin/exams/{$this->exam->id}/export-package")
            ->assertStatus(422);
    }

    public function test_import_package_rebuilds_graph_from_file(): void
    {
        $payload = app(SyncService::class)->buildExamPayload($this->exam);
        $examId  = $this->exam->id;
        $this->wipeDomain();
        $this->assertDatabaseCount('exams', 0);

        $file = UploadedFile::fake()->createWithContent('exam.json', json_encode($payload));

        $this->actingAs($this->admin, 'sanctum')
            ->post('/api/cbt-admin/import-package', ['file' => $file])
            ->assertOk()
            ->assertJsonPath('exam.id', $examId);

        $this->assertDatabaseHas('exams', ['id' => $examId]);
        $this->assertDatabaseCount('exam_codes', 3);
        $this->assertDatabaseCount('questions', 1);
    }

    public function test_import_package_rejects_non_package_file(): void
    {
        $file = UploadedFile::fake()->createWithContent('bad.json', json_encode(['nope' => true]));

        $this->actingAs($this->admin, 'sanctum')
            ->post('/api/cbt-admin/import-package', ['file' => $file])
            ->assertStatus(422);
    }

    public function test_export_then_import_results_via_file(): void
    {
        $student = Student::first();
        ExamResult::create([
            'exam_id' => $this->exam->id, 'student_id' => $student->id,
            'total_score' => 1, 'total_marks' => 1, 'percentage' => 100, 'grade' => 'A', 'is_absent' => false,
        ]);

        // Offline exports the results file.
        $export = $this->actingAs($this->admin, 'sanctum')
            ->get("/api/cbt-admin/exams/{$this->exam->id}/export-results")
            ->assertOk();
        $package = json_decode($export->getContent(), true);
        $this->assertCount(1, $package['results']);

        // Wipe results to simulate the online side, then import the file there.
        ExamResult::query()->delete();
        $file = UploadedFile::fake()->createWithContent('results.json', json_encode($package));

        $this->actingAs($this->admin, 'sanctum')
            ->post("/api/cbt-admin/exams/{$this->exam->id}/import-results", ['file' => $file])
            ->assertOk();

        $this->assertDatabaseHas('exam_results', ['exam_id' => $this->exam->id, 'student_id' => $student->id, 'grade' => 'A']);
        $this->assertEquals(ExamStatus::ResultsSynced, $this->exam->fresh()->status);
    }

    public function test_import_results_rejects_mismatched_exam(): void
    {
        $file = UploadedFile::fake()->createWithContent('results.json', json_encode(['exam_id' => 999999, 'sessions' => [], 'results' => []]));

        $this->actingAs($this->admin, 'sanctum')
            ->post("/api/cbt-admin/exams/{$this->exam->id}/import-results", ['file' => $file])
            ->assertStatus(422);
    }

    // ── NETWORK transport (offline-initiated) ───────────────────────────────────

    public function test_network_pull_imports_exam_from_online(): void
    {
        config(['cbt.online_server_url' => 'http://online.example']);
        $payload = app(SyncService::class)->buildExamPayload($this->exam);
        $examId  = $this->exam->id;
        $this->wipeDomain();

        Http::fake(['*/api/sync/exam-package/*' => Http::response($payload, 200)]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/cbt-admin/offline/pull-exam', ['exam_id' => $examId])
            ->assertOk();

        Http::assertSent(fn ($r) => str_contains($r->url(), "/api/sync/exam-package/{$examId}")
            && $r->hasHeader('X-Sync-Secret', 'test-secret'));
        $this->assertDatabaseHas('exams', ['id' => $examId]);
    }

    public function test_network_pull_requires_online_url(): void
    {
        config(['cbt.online_server_url' => null]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/cbt-admin/offline/pull-exam', ['exam_id' => $this->exam->id])
            ->assertStatus(422);
    }

    public function test_network_push_results_posts_to_online(): void
    {
        config(['cbt.online_server_url' => 'http://online.example']);
        $student = Student::first();
        ExamResult::create([
            'exam_id' => $this->exam->id, 'student_id' => $student->id,
            'total_score' => 1, 'total_marks' => 1, 'percentage' => 100, 'grade' => 'A', 'is_absent' => false,
        ]);

        Http::fake(['*/api/sync/receive-results/*' => Http::response(['received' => true], 200)]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/cbt-admin/exams/{$this->exam->id}/network-push-results")
            ->assertOk();

        Http::assertSent(fn ($r) => str_contains($r->url(), "/api/sync/receive-results/{$this->exam->id}")
            && count($r['results']) === 1
            && $r->hasHeader('X-Sync-Secret', 'test-secret'));
    }

    // ── Secret-protected network endpoints (run on the online server) ───────────

    public function test_secret_exam_package_endpoint_returns_payload(): void
    {
        $this->withHeaders(['X-Sync-Secret' => 'test-secret'])
            ->getJson("/api/sync/exam-package/{$this->exam->id}")
            ->assertOk()
            ->assertJsonPath('exam.id', $this->exam->id)
            ->assertJsonCount(3, 'exam_codes');
    }

    public function test_secret_receive_results_applies_them(): void
    {
        $student = Student::first();
        $package = [
            'exam_id'  => $this->exam->id,
            'sessions' => [],
            'results'  => [[
                'id' => 1, 'exam_id' => $this->exam->id, 'student_id' => $student->id,
                'total_score' => 1, 'total_marks' => 1, 'percentage' => 100, 'grade' => 'A', 'is_absent' => false,
            ]],
        ];

        $this->withHeaders(['X-Sync-Secret' => 'test-secret'])
            ->postJson("/api/sync/receive-results/{$this->exam->id}", $package)
            ->assertOk()
            ->assertJsonPath('received', true);

        $this->assertDatabaseHas('exam_results', ['exam_id' => $this->exam->id, 'grade' => 'A']);
        $this->assertEquals(ExamStatus::ResultsSynced, $this->exam->fresh()->status);
    }
}
