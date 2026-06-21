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

    // ── Combinations ──────────────────────────────────────────────────────────

    public function test_can_create_combination_coupling_two_departments(): void
    {
        $csc = Department::factory()->create(['school_id' => $this->school->id, 'code' => 'CSC']);
        $mat = Department::factory()->create(['school_id' => $this->school->id, 'code' => 'MAT']);

        $this->act()->postJson('/api/exam-officer/combinations', [
            'name'           => 'Computer Science / Mathematics',
            'code'           => 'CSC/MAT',
            'department_ids' => [$csc->id, $mat->id],
        ])
            ->assertCreated()
            ->assertJsonPath('data.code', 'CSC/MAT')
            ->assertJsonCount(2, 'data.departments');

        $this->assertDatabaseHas('combinations', ['code' => 'CSC/MAT', 'school_id' => $this->school->id]);
    }

    public function test_combination_requires_at_least_two_departments(): void
    {
        $csc = Department::factory()->create(['school_id' => $this->school->id]);

        $this->act()->postJson('/api/exam-officer/combinations', [
            'name'           => 'Solo',
            'code'           => 'SOLO',
            'department_ids' => [$csc->id],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('department_ids');
    }

    public function test_combination_departments_must_belong_to_school(): void
    {
        $mine    = Department::factory()->create(['school_id' => $this->school->id]);
        $foreign = Department::factory()->create(); // other school

        $this->act()->postJson('/api/exam-officer/combinations', [
            'name'           => 'X',
            'code'           => 'X/Y',
            'department_ids' => [$mine->id, $foreign->id],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('department_ids.1');
    }

    // ── Academic calendar ─────────────────────────────────────────────────────

    public function test_first_session_becomes_current_automatically(): void
    {
        $this->act()->postJson('/api/exam-officer/academic-calendar/sessions', ['session' => '2024/2025'])
            ->assertCreated()
            ->assertJsonPath('data.is_current', true);

        $this->assertDatabaseHas('academic_sessions', [
            'school_id' => $this->school->id, 'session' => '2024/2025', 'is_current' => true,
        ]);
    }

    public function test_setting_current_session_unsets_the_previous_one(): void
    {
        $old = \App\Models\AcademicSession::factory()->current()->create(['school_id' => $this->school->id, 'session' => '2023/2024']);
        $new = \App\Models\AcademicSession::factory()->create(['school_id' => $this->school->id, 'session' => '2024/2025']);

        $this->act()->postJson("/api/exam-officer/academic-calendar/sessions/{$new->id}/set-current")
            ->assertOk();

        $this->assertFalse($old->fresh()->is_current);
        $this->assertTrue($new->fresh()->is_current);
    }

    public function test_can_set_current_semester(): void
    {
        $this->act()->putJson('/api/exam-officer/academic-calendar/semester', ['semester' => 'second'])
            ->assertOk()
            ->assertJsonPath('current_semester', 'second');

        $this->assertEquals('second', $this->school->fresh()->current_semester->value);
    }

    // ── Department officers ───────────────────────────────────────────────────

    public function test_can_create_department_officer(): void
    {
        $dept = Department::factory()->create(['school_id' => $this->school->id]);

        $this->act()->postJson('/api/exam-officer/department-officers', [
            'file_number'   => 'DEO/0001',
            'name'          => 'Mr. Sani',
            'department_id' => $dept->id,
        ])
            ->assertCreated()
            ->assertJsonStructure(['user', 'temp_password']);

        $this->assertDatabaseHas('users', [
            'file_number'   => 'DEO/0001',
            'role'          => UserRole::DepartmentExamOfficer->value,
            'department_id' => $dept->id,
        ]);
    }

    public function test_can_promote_lecturer_to_department_officer(): void
    {
        $dept     = Department::factory()->create(['school_id' => $this->school->id]);
        $lecturer = User::factory()->role(UserRole::Lecturer)->create(['school_id' => $this->school->id]);

        $this->act()->postJson("/api/exam-officer/department-officers/{$lecturer->id}/promote", [
            'department_id' => $dept->id,
        ])
            ->assertOk()
            ->assertJsonPath('data.role', UserRole::DepartmentExamOfficer->value);

        $this->assertEquals(UserRole::DepartmentExamOfficer, $lecturer->fresh()->role);
        $this->assertEquals($dept->id, $lecturer->fresh()->department_id);
    }

    public function test_can_demote_department_officer_to_lecturer(): void
    {
        $dept    = Department::factory()->create(['school_id' => $this->school->id]);
        $officer = User::factory()->role(UserRole::DepartmentExamOfficer)
            ->create(['school_id' => $this->school->id, 'department_id' => $dept->id]);

        $this->act()->postJson("/api/exam-officer/department-officers/{$officer->id}/demote")
            ->assertOk()
            ->assertJsonPath('data.role', UserRole::Lecturer->value);
    }

    public function test_cannot_manage_department_officer_from_another_school(): void
    {
        $outsider = User::factory()->role(UserRole::DepartmentExamOfficer)->create(); // other school

        $this->act()->postJson("/api/exam-officer/department-officers/{$outsider->id}/demote")
            ->assertNotFound();
    }

    // ── Combination assignment + auto-enrolment ───────────────────────────────

    public function test_assigning_students_to_combination_auto_enrols_in_both_departments(): void
    {
        \App\Models\AcademicSession::factory()->current()->create(['school_id' => $this->school->id, 'session' => '2024/2025']);

        $csc = Department::factory()->create(['school_id' => $this->school->id, 'code' => 'CSC']);
        $mat = Department::factory()->create(['school_id' => $this->school->id, 'code' => 'MAT']);

        $combination = \App\Models\Combination::factory()->create(['school_id' => $this->school->id, 'code' => 'CSC/MAT']);
        $combination->departments()->sync([$csc->id, $mat->id]);

        // One 100L course in each department, plus a 200L course that must be skipped.
        $cscCourse = Course::factory()->create(['school_id' => $this->school->id, 'department_id' => $csc->id, 'level' => StudentLevel::Nce100->value, 'semester' => 'first']);
        $matCourse = Course::factory()->create(['school_id' => $this->school->id, 'department_id' => $mat->id, 'level' => StudentLevel::Nce100->value, 'semester' => 'first']);
        $other200  = Course::factory()->create(['school_id' => $this->school->id, 'department_id' => $csc->id, 'level' => StudentLevel::Nce200->value, 'semester' => 'first']);

        $student = Student::factory()->create([
            'school_id' => $this->school->id,
            'level'     => StudentLevel::Nce100->value,
        ]);

        $this->act()->postJson("/api/exam-officer/combinations/{$combination->id}/assign-students", [
            'student_ids' => [$student->id],
        ])
            ->assertOk()
            ->assertJsonPath('enrolments_created', 2);

        $this->assertEquals($combination->id, $student->fresh()->combination_id);
        $this->assertDatabaseHas('student_courses', ['student_id' => $student->id, 'course_id' => $cscCourse->id]);
        $this->assertDatabaseHas('student_courses', ['student_id' => $student->id, 'course_id' => $matCourse->id]);
        $this->assertDatabaseMissing('student_courses', ['student_id' => $student->id, 'course_id' => $other200->id]);
    }

    public function test_cannot_assign_to_combination_without_a_current_session(): void
    {
        $csc = Department::factory()->create(['school_id' => $this->school->id]);
        $mat = Department::factory()->create(['school_id' => $this->school->id]);
        $combination = \App\Models\Combination::factory()->create(['school_id' => $this->school->id]);
        $combination->departments()->sync([$csc->id, $mat->id]);

        $student = Student::factory()->create(['school_id' => $this->school->id]);

        $this->act()->postJson("/api/exam-officer/combinations/{$combination->id}/assign-students", [
            'student_ids' => [$student->id],
        ])
            ->assertUnprocessable();
    }
}
