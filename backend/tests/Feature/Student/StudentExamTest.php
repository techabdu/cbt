<?php

namespace Tests\Feature\Student;

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
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StudentExamTest extends TestCase
{
    use RefreshDatabase;

    private Exam    $exam;
    private Student $student;
    private string  $code = 'ABCD2345';

    protected function setUp(): void
    {
        parent::setUp();

        // These routes only exist on the offline server.
        config(['cbt.is_offline_server' => true]);

        College::factory()->create();
        $school   = School::factory()->create();
        $dept     = Department::factory()->create(['school_id' => $school->id]);
        $lecturer = User::factory()->role(UserRole::Lecturer)->create(['school_id' => $school->id]);
        $course   = Course::factory()->create(['school_id' => $school->id, 'department_id' => $dept->id]);

        $bank = QuestionBank::factory()->status(QuestionBankStatus::Approved)->create([
            'lecturer_id' => $lecturer->id, 'course_id' => $course->id,
            'session' => '2024/2025', 'semester' => 'first',
        ]);

        // MCQ (correct B), True/False (true), Fill blank (paris)
        $mcq = $bank->questions()->create(['question_text' => '2+2?', 'question_type' => 'mcq', 'marks' => 2, 'order_index' => 1]);
        $mcq->options()->createMany([
            ['option_label' => 'A', 'option_text' => '3', 'is_correct' => false],
            ['option_label' => 'B', 'option_text' => '4', 'is_correct' => true],
        ]);
        $tf = $bank->questions()->create(['question_text' => 'Sky is blue', 'question_type' => 'true_false', 'marks' => 1, 'order_index' => 2]);
        $tf->options()->createMany([
            ['option_label' => 'T', 'option_text' => 'True', 'is_correct' => true],
            ['option_label' => 'F', 'option_text' => 'False', 'is_correct' => false],
        ]);
        $fb = $bank->questions()->create(['question_text' => 'Capital of France', 'question_type' => 'fill_blank', 'marks' => 2, 'order_index' => 3]);
        $fb->answers()->create(['correct_answer' => 'Paris']);
        $bank->update(['total_questions' => 3]);

        $this->exam = Exam::factory()->create([
            'course_id' => $course->id, 'question_bank_id' => $bank->id,
            'session' => '2024/2025', 'semester' => 'first', 'duration_minutes' => 60,
        ]);

        $this->student = Student::factory()->create(['school_id' => $school->id, 'department_id' => $dept->id, 'matric_number' => 'NCE/2024/777']);
        ExamCode::create(['exam_id' => $this->exam->id, 'student_id' => $this->student->id, 'code' => $this->code, 'is_used' => false]);
    }

    private function login(): array
    {
        return $this->postJson('/api/student/exam/login', [
            'matric_number' => 'NCE/2024/777',
            'exam_code'     => $this->code,
        ])->json();
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    public function test_student_can_login_and_receive_questions_without_answers(): void
    {
        $res = $this->postJson('/api/student/exam/login', [
            'matric_number' => 'NCE/2024/777',
            'exam_code'     => $this->code,
        ]);

        $res->assertOk()
            ->assertJsonStructure(['token', 'session' => ['ends_at', 'duration_minutes'], 'questions', 'saved_answers'])
            ->assertJsonCount(3, 'questions');

        // Ensure no correctness data leaks to the student.
        $body = $res->json();
        $json = json_encode($body['questions']);
        $this->assertStringNotContainsString('is_correct', $json);
        $this->assertStringNotContainsString('correct_answer', $json);
    }

    public function test_login_marks_code_used(): void
    {
        $this->login();
        $this->assertTrue(ExamCode::where('code', $this->code)->first()->is_used);
    }

    public function test_invalid_code_is_rejected(): void
    {
        $this->postJson('/api/student/exam/login', ['matric_number' => 'NCE/2024/777', 'exam_code' => 'WRONGXXX'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('exam_code');
    }

    public function test_routes_blocked_when_not_offline_server(): void
    {
        config(['cbt.is_offline_server' => false]);
        $this->postJson('/api/student/exam/login', ['matric_number' => 'x', 'exam_code' => 'y'])
            ->assertForbidden();
    }

    // ── Answering & token auth ─────────────────────────────────────────────────

    public function test_answer_requires_valid_token(): void
    {
        $this->postJson('/api/student/exam/answer', ['question_id' => 1, 'answer' => 'B'])
            ->assertUnauthorized();
    }

    public function test_full_flow_login_answer_submit_grades_correctly(): void
    {
        $login = $this->login();
        $token = $login['token'];
        $headers = ['X-Exam-Token' => $token];

        // Resolve question ids by type from the (shuffled) payload.
        $byText = collect($login['questions'])->keyBy('question_text');
        $mcqId = $byText['2+2?']['id'];
        $tfId  = $byText['Sky is blue']['id'];
        $fbId  = $byText['Capital of France']['id'];

        // Answer MCQ correct (B = 2 marks), TF wrong (F), fill blank correct case-insensitive (2 marks)
        $this->postJson('/api/student/exam/answer', ['question_id' => $mcqId, 'answer' => 'B'], $headers)->assertOk();
        $this->postJson('/api/student/exam/answer', ['question_id' => $tfId, 'answer' => 'F'], $headers)->assertOk();
        $this->postJson('/api/student/exam/autosave', [
            'answers' => [['question_id' => $fbId, 'answer' => '  paris ']],
        ], $headers)->assertOk();

        $submit = $this->postJson('/api/student/exam/submit', [], $headers)->assertOk()->json();
        $this->assertEquals(3, $submit['answered']);

        // Score: MCQ 2 + TF 0 + FB 2 = 4 of 5 marks.
        $this->assertDatabaseHas('exam_results', [
            'exam_id' => $this->exam->id, 'student_id' => $this->student->id,
            'total_score' => 4, 'total_marks' => 5,
        ]);
        $result = \App\Models\ExamResult::first();
        $this->assertEquals(80.00, (float) $result->percentage);
        $this->assertEquals('A', $result->grade);
    }

    public function test_cannot_submit_twice(): void
    {
        $login = $this->login();
        $headers = ['X-Exam-Token' => $login['token']];

        $this->postJson('/api/student/exam/submit', [], $headers)->assertOk();
        $this->postJson('/api/student/exam/submit', [], $headers)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('session');
    }

    public function test_cannot_login_after_submitting(): void
    {
        $login = $this->login();
        $this->postJson('/api/student/exam/submit', [], ['X-Exam-Token' => $login['token']])->assertOk();

        $this->postJson('/api/student/exam/login', ['matric_number' => 'NCE/2024/777', 'exam_code' => $this->code])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('exam_code');
    }

    public function test_resume_returns_saved_answers(): void
    {
        $login = $this->login();
        $headers = ['X-Exam-Token' => $login['token']];
        $mcqId = collect($login['questions'])->firstWhere('question_text', '2+2?')['id'];

        $this->postJson('/api/student/exam/answer', ['question_id' => $mcqId, 'answer' => 'B'], $headers)->assertOk();

        $resume = $this->getJson('/api/student/exam/resume', $headers)->assertOk()->json();
        $this->assertEquals('B', $resume['saved_answers'][$mcqId]);
    }

    public function test_auto_submit_flag_recorded(): void
    {
        $login = $this->login();
        $this->postJson('/api/student/exam/submit', ['auto_submitted' => true], ['X-Exam-Token' => $login['token']])->assertOk();

        $this->assertTrue(\App\Models\ExamSession::first()->is_auto_submitted);
    }

    // ── Server-side time enforcement ───────────────────────────────────────────

    public function test_answers_accepted_within_grace_window(): void
    {
        $login = $this->login();
        $headers = ['X-Exam-Token' => $login['token']];
        $mcqId = collect($login['questions'])->firstWhere('question_text', '2+2?')['id'];

        // 60-min exam + 120s grace: one minute past ends_at is still accepted
        // (the client's final autosave flush arrives up to ~60s late).
        $this->travel(61)->minutes();

        $this->postJson('/api/student/exam/answer', ['question_id' => $mcqId, 'answer' => 'B'], $headers)->assertOk();
    }

    public function test_answers_rejected_after_time_expires(): void
    {
        $login = $this->login();
        $headers = ['X-Exam-Token' => $login['token']];
        $mcqId = collect($login['questions'])->firstWhere('question_text', '2+2?')['id'];

        $this->travel(63)->minutes(); // past ends_at + grace

        $this->postJson('/api/student/exam/answer', ['question_id' => $mcqId, 'answer' => 'B'], $headers)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('session');

        $this->postJson('/api/student/exam/autosave', [
            'answers' => [['question_id' => $mcqId, 'answer' => 'B']],
        ], $headers)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('session');
    }

    public function test_late_submit_is_accepted_but_flagged_auto_submitted(): void
    {
        $login = $this->login();
        $headers = ['X-Exam-Token' => $login['token']];

        $this->travel(63)->minutes(); // past ends_at + grace

        $this->postJson('/api/student/exam/submit', [], $headers)->assertOk();

        $session = \App\Models\ExamSession::first();
        $this->assertNotNull($session->submitted_at);
        $this->assertTrue($session->is_auto_submitted);
    }

    // ── Login throttling & races ───────────────────────────────────────────────

    public function test_login_is_rate_limited_per_ip(): void
    {
        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/student/exam/login', ['matric_number' => 'NCE/2024/777', 'exam_code' => 'WRONGXXX'])
                ->assertUnprocessable();
        }

        $this->postJson('/api/student/exam/login', ['matric_number' => 'NCE/2024/777', 'exam_code' => 'WRONGXXX'])
            ->assertTooManyRequests();
    }

    public function test_concurrent_first_logins_do_not_500(): void
    {
        // Simulate the double-click race: a parallel request inserts the session
        // row just before this login's save(), forcing the unique-key violation.
        \App\Models\ExamSession::creating(function () {
            \Illuminate\Support\Facades\DB::table('exam_sessions')->insert([
                'exam_id' => $this->exam->id,
                'student_id' => $this->student->id,
                'started_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        $this->postJson('/api/student/exam/login', [
            'matric_number' => 'NCE/2024/777',
            'exam_code' => $this->code,
        ])->assertOk();

        $this->assertEquals(1, \App\Models\ExamSession::count());
    }
}
