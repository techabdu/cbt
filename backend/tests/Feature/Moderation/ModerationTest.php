<?php

namespace Tests\Feature\Moderation;

use App\Enums\QuestionBankStatus;
use App\Enums\UserRole;
use App\Models\College;
use App\Models\Course;
use App\Models\Department;
use App\Models\QuestionBank;
use App\Models\School;
use App\Models\User;
use App\Notifications\QuestionBankApproved;
use App\Notifications\QuestionBankReadyForExam;
use App\Notifications\QuestionBankRejected;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class ModerationTest extends TestCase
{
    use RefreshDatabase;

    private School $school;
    private User   $officer;
    private User   $lecturer;
    private Course $course;

    protected function setUp(): void
    {
        parent::setUp();

        College::factory()->create();
        $this->school   = School::factory()->create();
        $dept           = Department::factory()->create(['school_id' => $this->school->id]);
        $this->officer  = User::factory()->role(UserRole::ExamOfficer)->create(['school_id' => $this->school->id]);
        $this->lecturer = User::factory()->role(UserRole::Lecturer)->create(['school_id' => $this->school->id]);
        $this->course   = Course::factory()->create(['school_id' => $this->school->id, 'department_id' => $dept->id]);
    }

    private function act(): static
    {
        $this->actingAs($this->officer, 'sanctum');
        return $this;
    }

    private function submittedBank(): QuestionBank
    {
        return QuestionBank::factory()
            ->status(QuestionBankStatus::Submitted)
            ->create([
                'lecturer_id'  => $this->lecturer->id,
                'course_id'    => $this->course->id,
                'submitted_at' => now(),
                'total_questions' => 5,
            ]);
    }

    // ── Queue listing ───────────────────────────────────────────────────────

    public function test_moderation_queue_lists_submitted_banks_in_school(): void
    {
        $this->submittedBank();
        // Draft bank should NOT appear (never submitted).
        QuestionBank::factory()->create(['lecturer_id' => $this->lecturer->id, 'course_id' => $this->course->id]);

        $this->act()->getJson('/api/exam-officer/moderation')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_queue_excludes_other_schools_banks(): void
    {
        // A bank in a different school.
        $otherSchool = School::factory()->create();
        $otherDept   = Department::factory()->create(['school_id' => $otherSchool->id]);
        $otherCourse = Course::factory()->create(['school_id' => $otherSchool->id, 'department_id' => $otherDept->id]);
        QuestionBank::factory()->status(QuestionBankStatus::Submitted)->create([
            'lecturer_id' => User::factory()->role(UserRole::Lecturer)->create(['school_id' => $otherSchool->id])->id,
            'course_id'   => $otherCourse->id,
        ]);

        $this->act()->getJson('/api/exam-officer/moderation')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_lecturer_cannot_access_moderation(): void
    {
        $this->actingAs($this->lecturer, 'sanctum')
            ->getJson('/api/exam-officer/moderation')
            ->assertForbidden();
    }

    // ── Reviewing ───────────────────────────────────────────────────────────

    public function test_opening_submitted_bank_moves_it_under_review(): void
    {
        $bank = $this->submittedBank();

        $this->act()->getJson("/api/exam-officer/moderation/{$bank->id}")
            ->assertOk()
            ->assertJsonPath('data.status', 'under_review');

        $this->assertEquals(QuestionBankStatus::UnderReview, $bank->fresh()->status);
    }

    public function test_cannot_review_bank_from_another_school(): void
    {
        $otherSchool = School::factory()->create();
        $otherDept   = Department::factory()->create(['school_id' => $otherSchool->id]);
        $otherCourse = Course::factory()->create(['school_id' => $otherSchool->id, 'department_id' => $otherDept->id]);
        $bank = QuestionBank::factory()->status(QuestionBankStatus::Submitted)->create([
            'lecturer_id' => $this->lecturer->id,
            'course_id'   => $otherCourse->id,
        ]);

        $this->act()->getJson("/api/exam-officer/moderation/{$bank->id}")
            ->assertNotFound();
    }

    // ── Approval ────────────────────────────────────────────────────────────

    public function test_can_approve_bank_and_notify_lecturer_and_cbt_admins(): void
    {
        Notification::fake();
        $cbtAdmin = User::factory()->role(UserRole::CbtAdmin)->create();
        $bank     = $this->submittedBank();

        $this->act()->postJson("/api/exam-officer/moderation/{$bank->id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.reviewer.id', $this->officer->id);

        $this->assertEquals(QuestionBankStatus::Approved, $bank->fresh()->status);

        Notification::assertSentTo($this->lecturer, QuestionBankApproved::class);
        Notification::assertSentTo($cbtAdmin, QuestionBankReadyForExam::class);
    }

    public function test_approval_persists_database_notification_to_lecturer(): void
    {
        $bank = $this->submittedBank();

        $this->act()->postJson("/api/exam-officer/moderation/{$bank->id}/approve")
            ->assertOk();

        $this->assertDatabaseHas('notifications', [
            'notifiable_id'   => $this->lecturer->id,
            'notifiable_type' => User::class,
        ]);
        $this->assertEquals(1, $this->lecturer->unreadNotifications()->count());
    }

    public function test_cannot_approve_a_draft_bank(): void
    {
        $bank = QuestionBank::factory()->create(['lecturer_id' => $this->lecturer->id, 'course_id' => $this->course->id]);

        $this->act()->postJson("/api/exam-officer/moderation/{$bank->id}/approve")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');
    }

    // ── Rejection ───────────────────────────────────────────────────────────

    public function test_can_reject_bank_with_reason(): void
    {
        Notification::fake();
        $bank = $this->submittedBank();

        $this->act()->postJson("/api/exam-officer/moderation/{$bank->id}/reject", [
            'reason' => 'Question 3 has two correct options. Please fix.',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected')
            ->assertJsonPath('data.rejection_reason', 'Question 3 has two correct options. Please fix.');

        Notification::assertSentTo($this->lecturer, QuestionBankRejected::class);
    }

    public function test_rejection_requires_a_reason(): void
    {
        $bank = $this->submittedBank();

        $this->act()->postJson("/api/exam-officer/moderation/{$bank->id}/reject", ['reason' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason');
    }

    public function test_rejected_bank_becomes_editable_for_lecturer_again(): void
    {
        $bank = $this->submittedBank();

        $this->act()->postJson("/api/exam-officer/moderation/{$bank->id}/reject", [
            'reason' => 'Needs more questions.',
        ])->assertOk();

        // Lecturer can now add a question (bank is editable when rejected).
        $this->actingAs($this->lecturer, 'sanctum')
            ->postJson("/api/lecturer/question-banks/{$bank->id}/questions", [
                'question_text' => 'A new question?',
                'question_type' => 'fill_blank',
                'marks'         => 1,
                'answers'       => ['yes'],
            ])
            ->assertCreated();
    }

    public function test_can_filter_queue_by_status(): void
    {
        $this->submittedBank();
        QuestionBank::factory()->status(QuestionBankStatus::Approved)->create([
            'lecturer_id' => $this->lecturer->id,
            'course_id'   => $this->course->id,
            'reviewed_by' => $this->officer->id,
            'reviewed_at' => now(),
        ]);

        $this->act()->getJson('/api/exam-officer/moderation?filter[status]=approved')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', 'approved');
    }

    // ── Notification API ──────────────────────────────────────────────────────

    public function test_lecturer_can_list_and_mark_notifications_read(): void
    {
        $bank = $this->submittedBank();
        $this->act()->postJson("/api/exam-officer/moderation/{$bank->id}/approve")->assertOk();

        $this->actingAs($this->lecturer, 'sanctum');

        $feed = $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 1)
            ->json();

        $notificationId = $feed['notifications'][0]['id'];

        $this->patchJson("/api/notifications/{$notificationId}/read")
            ->assertOk()
            ->assertJsonPath('unread_count', 0);
    }
}
