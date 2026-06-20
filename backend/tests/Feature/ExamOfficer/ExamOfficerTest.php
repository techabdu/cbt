<?php

namespace Tests\Feature\ExamOfficer;

use App\Enums\StudentLevel;
use App\Enums\UserRole;
use App\Models\College;
use App\Models\Course;
use App\Models\Department;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExamOfficerTest extends TestCase
{
    use RefreshDatabase;

    private School $school;
    private User   $officer;

    protected function setUp(): void
    {
        parent::setUp();

        College::factory()->create();
        $this->school  = School::factory()->create();
        $this->officer = User::factory()->role(UserRole::ExamOfficer)->create(['school_id' => $this->school->id]);
    }

    private function act(): static
    {
        $this->actingAs($this->officer, 'sanctum');
        return $this;
    }

    // ── Access guard ──────────────────────────────────────────────────────────

    public function test_lecturer_cannot_access_exam_officer_routes(): void
    {
        $this->actingAs(User::factory()->role(UserRole::Lecturer)->create(['school_id' => $this->school->id]), 'sanctum')
            ->getJson('/api/exam-officer/departments')
            ->assertForbidden();
    }

    public function test_exam_officer_without_school_gets_403(): void
    {
        $this->actingAs(User::factory()->role(UserRole::ExamOfficer)->create(['school_id' => null]), 'sanctum')
            ->getJson('/api/exam-officer/departments')
            ->assertForbidden();
    }

    // ── Dashboard stats ───────────────────────────────────────────────────────

    public function test_stats_returns_school_scoped_counts(): void
    {
        Department::factory()->count(2)->create(['school_id' => $this->school->id]);
        // A department in another school must NOT be counted
        Department::factory()->create();

        $this->act()->getJson('/api/exam-officer/stats')
            ->assertOk()
            ->assertJsonPath('departments', 2);
    }

    // ── Departments ───────────────────────────────────────────────────────────

    public function test_can_list_departments(): void
    {
        Department::factory()->count(3)->create(['school_id' => $this->school->id]);

        $this->act()->getJson('/api/exam-officer/departments')
            ->assertOk()
            ->assertJsonCount(3, 'data');
    }

    public function test_can_create_department(): void
    {
        $this->act()->postJson('/api/exam-officer/departments', [
            'name'      => 'Computer Science',
            'code'      => 'CSC',
            'full_name' => 'Department of Computer Science',
        ])
            ->assertCreated()
            ->assertJsonPath('data.code', 'CSC');

        $this->assertDatabaseHas('departments', ['code' => 'CSC', 'school_id' => $this->school->id]);
    }

    public function test_department_code_unique_within_school(): void
    {
        Department::factory()->create(['school_id' => $this->school->id, 'code' => 'CSC']);

        $this->act()->postJson('/api/exam-officer/departments', ['name' => 'X', 'code' => 'CSC'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('code');
    }

    public function test_can_update_department(): void
    {
        $dept = Department::factory()->create(['school_id' => $this->school->id]);

        $this->act()->putJson("/api/exam-officer/departments/{$dept->id}", [
            'name' => 'Updated Name',
            'code' => 'UPD',
        ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Updated Name');
    }

    public function test_cannot_delete_department_with_students(): void
    {
        $dept    = Department::factory()->create(['school_id' => $this->school->id]);
        Student::factory()->create(['school_id' => $this->school->id, 'department_id' => $dept->id]);

        $this->act()->deleteJson("/api/exam-officer/departments/{$dept->id}")
            ->assertUnprocessable();
    }

    public function test_can_delete_empty_department(): void
    {
        $dept = Department::factory()->create(['school_id' => $this->school->id]);

        $this->act()->deleteJson("/api/exam-officer/departments/{$dept->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('departments', ['id' => $dept->id]);
    }

    public function test_cannot_access_other_school_department(): void
    {
        $otherDept = Department::factory()->create(); // different school

        $this->act()->putJson("/api/exam-officer/departments/{$otherDept->id}", [
            'name' => 'X',
            'code' => 'X',
        ])
            ->assertForbidden();
    }

    // ── Lecturers ─────────────────────────────────────────────────────────────

    public function test_can_create_lecturer(): void
    {
        $response = $this->act()->postJson('/api/exam-officer/lecturers', [
            'file_number' => 'LEC/0001',
            'name'        => 'Dr. Adamu',
        ])
            ->assertCreated()
            ->assertJsonStructure(['user', 'temp_password']);

        $this->assertDatabaseHas('users', ['file_number' => 'LEC/0001', 'role' => UserRole::Lecturer->value]);
    }

    public function test_lecturer_is_scoped_to_officers_school(): void
    {
        $response = $this->act()->postJson('/api/exam-officer/lecturers', [
            'file_number' => 'LEC/0002',
            'name'        => 'Mrs. Fatima',
        ])
            ->assertCreated();

        $this->assertDatabaseHas('users', ['file_number' => 'LEC/0002', 'school_id' => $this->school->id]);
    }

    public function test_lecturer_file_number_must_be_unique(): void
    {
        User::factory()->role(UserRole::Lecturer)->create([
            'school_id'   => $this->school->id,
            'file_number' => 'LEC/9999',
        ]);

        $this->act()->postJson('/api/exam-officer/lecturers', ['file_number' => 'LEC/9999', 'name' => 'X'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('file_number');
    }

    public function test_can_reset_lecturer_password(): void
    {
        $lecturer = User::factory()->role(UserRole::Lecturer)->create(['school_id' => $this->school->id]);

        $this->act()->postJson("/api/exam-officer/lecturers/{$lecturer->id}/reset-password")
            ->assertOk()
            ->assertJsonStructure(['temp_password']);

        $this->assertCount(0, $lecturer->fresh()->tokens);
    }

    // ── Students ──────────────────────────────────────────────────────────────

    public function test_can_create_student(): void
    {
        $dept = Department::factory()->create(['school_id' => $this->school->id]);

        $this->act()->postJson('/api/exam-officer/students', [
            'matric_number' => 'NCE/2024/001',
            'full_name'     => 'Amina Bello',
            'department_id' => $dept->id,
            'level'         => StudentLevel::Nce100->value,
        ])
            ->assertCreated()
            ->assertJsonPath('data.matric_number', 'NCE/2024/001');

        $this->assertDatabaseHas('students', ['matric_number' => 'NCE/2024/001', 'school_id' => $this->school->id]);
    }

    public function test_student_department_must_belong_to_officers_school(): void
    {
        $otherDept = Department::factory()->create(); // different school

        $this->act()->postJson('/api/exam-officer/students', [
            'matric_number' => 'NCE/2024/002',
            'full_name'     => 'Test',
            'department_id' => $otherDept->id,
            'level'         => StudentLevel::Nce100->value,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('department_id');
    }

    public function test_can_list_students_filtered_by_department(): void
    {
        $dept1 = Department::factory()->create(['school_id' => $this->school->id]);
        $dept2 = Department::factory()->create(['school_id' => $this->school->id]);
        Student::factory()->count(3)->create(['school_id' => $this->school->id, 'department_id' => $dept1->id]);
        Student::factory()->count(2)->create(['school_id' => $this->school->id, 'department_id' => $dept2->id]);

        $this->act()->getJson("/api/exam-officer/students?filter[department_id]={$dept1->id}")
            ->assertOk()
            ->assertJsonCount(3, 'data');
    }

    // ── Courses ───────────────────────────────────────────────────────────────

    public function test_can_create_course(): void
    {
        $dept = Department::factory()->create(['school_id' => $this->school->id]);

        $this->act()->postJson('/api/exam-officer/courses', [
            'department_id' => $dept->id,
            'title'         => 'Introduction to Computing',
            'code'          => 'CSC101',
            'credit_units'  => 3,
            'level'         => StudentLevel::Nce100->value,
            'semester'      => 'first',
        ])
            ->assertCreated()
            ->assertJsonPath('data.code', 'CSC101');
    }

    public function test_cannot_delete_course_with_assigned_lecturer(): void
    {
        $dept     = Department::factory()->create(['school_id' => $this->school->id]);
        $course   = Course::factory()->create(['school_id' => $this->school->id, 'department_id' => $dept->id]);
        $lecturer = User::factory()->role(UserRole::Lecturer)->create(['school_id' => $this->school->id]);
        $course->lecturers()->attach($lecturer->id, ['session' => '2024/2025', 'semester' => 'first']);

        $this->act()->deleteJson("/api/exam-officer/courses/{$course->id}")
            ->assertUnprocessable();
    }

    // ── Assignments ───────────────────────────────────────────────────────────

    public function test_can_assign_lecturer_to_course(): void
    {
        $dept     = Department::factory()->create(['school_id' => $this->school->id]);
        $course   = Course::factory()->create(['school_id' => $this->school->id, 'department_id' => $dept->id]);
        $lecturer = User::factory()->role(UserRole::Lecturer)->create(['school_id' => $this->school->id]);

        $this->act()->postJson("/api/exam-officer/courses/{$course->id}/assign-lecturer", [
            'lecturer_id' => $lecturer->id,
            'session'     => '2024/2025',
            'semester'    => 'first',
        ])
            ->assertOk();

        $this->assertDatabaseHas('lecturer_courses', [
            'course_id'   => $course->id,
            'lecturer_id' => $lecturer->id,
        ]);
    }

    public function test_cannot_assign_lecturer_from_another_school(): void
    {
        $dept     = Department::factory()->create(['school_id' => $this->school->id]);
        $course   = Course::factory()->create(['school_id' => $this->school->id, 'department_id' => $dept->id]);
        $outsider = User::factory()->role(UserRole::Lecturer)->create(); // different school

        $this->act()->postJson("/api/exam-officer/courses/{$course->id}/assign-lecturer", [
            'lecturer_id' => $outsider->id,
            'session'     => '2024/2025',
            'semester'    => 'first',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('lecturer_id');
    }

    public function test_can_enroll_students_in_course(): void
    {
        $dept     = Department::factory()->create(['school_id' => $this->school->id]);
        $course   = Course::factory()->create(['school_id' => $this->school->id, 'department_id' => $dept->id]);
        $students = Student::factory()->count(5)->create(['school_id' => $this->school->id, 'department_id' => $dept->id]);

        $this->act()->postJson("/api/exam-officer/courses/{$course->id}/assign-students", [
            'student_ids' => $students->pluck('id')->all(),
            'session'     => '2024/2025',
            'semester'    => 'first',
        ])
            ->assertOk();

        $this->assertDatabaseHas('student_courses', [
            'course_id'  => $course->id,
            'student_id' => $students->first()->id,
        ]);
    }

    public function test_can_remove_lecturer_from_course(): void
    {
        $dept     = Department::factory()->create(['school_id' => $this->school->id]);
        $course   = Course::factory()->create(['school_id' => $this->school->id, 'department_id' => $dept->id]);
        $lecturer = User::factory()->role(UserRole::Lecturer)->create(['school_id' => $this->school->id]);
        $course->lecturers()->attach($lecturer->id, ['session' => '2024/2025', 'semester' => 'first']);

        $this->act()->deleteJson("/api/exam-officer/courses/{$course->id}/lecturers/{$lecturer->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('lecturer_courses', ['course_id' => $course->id, 'lecturer_id' => $lecturer->id]);
    }
}
