<?php

namespace Tests\Feature\Student;

use App\Enums\QuestionBankStatus;
use App\Enums\UserRole;
use App\Models\College;
use App\Models\Course;
use App\Models\Department;
use App\Models\Exam;
use App\Models\ExamCode;
use App\Models\ExamSession;
use App\Models\QuestionBank;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The exam:submit-expired sweeper is the server-side timer safety net: a
 * session whose browser crashed (or whose timer was tampered with) must still
 * be force-submitted and graded once its time (plus grace) runs out.
 */
class ExpiredSessionSweepTest extends TestCase
{
    use RefreshDatabase;

    private Exam $exam;

    private Student $student;

    private string $code = 'SWEE2345';

    protected function setUp(): void
    {
        parent::setUp();

        config(['cbt.is_offline_server' => true]);

        College::factory()->create();
        $school = School::factory()->create();
        $dept = Department::factory()->create(['school_id' => $school->id]);
        $lecturer = User::factory()->role(UserRole::Lecturer)->create(['school_id' => $school->id]);
        $course = Course::factory()->create(['school_id' => $school->id, 'department_id' => $dept->id]);

        $bank = QuestionBank::factory()->status(QuestionBankStatus::Approved)->create([
            'lecturer_id' => $lecturer->id, 'course_id' => $course->id,
            'session' => '2024/2025', 'semester' => 'first',
        ]);
        $mcq = $bank->questions()->create(['question_text' => '2+2?', 'question_type' => 'mcq', 'marks' => 2, 'order_index' => 1]);
        $mcq->options()->createMany([
            ['option_label' => 'A', 'option_text' => '3', 'is_correct' => false],
            ['option_label' => 'B', 'option_text' => '4', 'is_correct' => true],
        ]);
        $bank->update(['total_questions' => 1]);

        $this->exam = Exam::factory()->create([
            'course_id' => $course->id, 'question_bank_id' => $bank->id,
            'session' => '2024/2025', 'semester' => 'first', 'duration_minutes' => 60,
        ]);

        $this->student = Student::factory()->create(['school_id' => $school->id, 'department_id' => $dept->id, 'matric_number' => 'NCE/2024/888']);
        ExamCode::create(['exam_id' => $this->exam->id, 'student_id' => $this->student->id, 'code' => $this->code, 'is_used' => false]);
    }

    private function login(): array
    {
        return $this->postJson('/api/student/exam/login', [
            'matric_number' => 'NCE/2024/888',
            'exam_code' => $this->code,
        ])->assertOk()->json();
    }

    public function test_sweep_force_submits_and_grades_expired_sessions(): void
    {
        $login = $this->login();
        $mcqId = collect($login['questions'])->firstWhere('question_text', '2+2?')['id'];

        // Student answers, then the browser "crashes" — no submit ever arrives.
        $this->postJson('/api/student/exam/answer', ['question_id' => $mcqId, 'answer' => 'B'], ['X-Exam-Token' => $login['token']])->assertOk();

        $this->travel(2)->hours();

        $this->artisan('exam:submit-expired')
            ->expectsOutputToContain('Submitted 1 expired exam session(s).')
            ->assertSuccessful();

        $session = ExamSession::first();
        $this->assertNotNull($session->submitted_at);
        $this->assertTrue($session->is_auto_submitted);

        // Grading ran (sync queue in tests): the answered MCQ scored its marks.
        $this->assertDatabaseHas('exam_results', [
            'exam_id' => $this->exam->id, 'student_id' => $this->student->id,
            'total_score' => 2, 'total_marks' => 2,
        ]);
    }

    public function test_sweep_leaves_open_sessions_alone(): void
    {
        $this->login();

        $this->travel(30)->minutes(); // still inside the 60-min window

        $this->artisan('exam:submit-expired')
            ->expectsOutputToContain('Submitted 0 expired exam session(s).')
            ->assertSuccessful();

        $this->assertNull(ExamSession::first()->submitted_at);
    }
}
