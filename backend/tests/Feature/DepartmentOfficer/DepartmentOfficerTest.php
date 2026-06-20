<?php

namespace Tests\Feature\DepartmentOfficer;

use App\Enums\StudentLevel;
use App\Enums\UserRole;
use App\Models\AcademicSession;
use App\Models\College;
use App\Models\Combination;
use App\Models\Course;
use App\Models\Department;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DepartmentOfficerTest extends TestCase
{
    use RefreshDatabase;

    private School     $school;
    private Department $dept;
    private User       $officer;

    protected function setUp(): void
    {
        parent::setUp();

        College::factory()->create();
        $this->school  = School::factory()->create();
        $this->dept    = Department::factory()->create(['school_id' => $this->school->id]);
        $this->officer = User::factory()->role(UserRole::DepartmentExamOfficer)
            ->create(['school_id' => $this->school->id, 'department_id' => $this->dept->id]);
    }

    private function act(): static
    {
        $this->actingAs($this->officer, 'sanctum');
        return $this;
    }

    // ── Access guards ─────────────────────────────────────────────────────────

    public function test_lecturer_cannot_access_department_officer_routes(): void
    {
        $this->actingAs(User::factory()->role(UserRole::Lecturer)->create(['school_id' => $this->school->id]), 'sanctum')
            ->getJson('/api/department-officer/courses')
            ->assertForbidden();
    }

    public function test_officer_without_department_gets_403(): void
    {
        $orphan = User::factory()->role(UserRole::DepartmentExamOfficer)->create(['school_id' => $this->school->id, 'department_id' => null]);

        $this->actingAs($orphan, 'sanctum')
            ->getJson('/api/department-officer/courses')
            ->assertForbidden();
    }

    // ── Courses ───────────────────────────────────────────────────────────────

    public function test_can_create_course_pinned_to_own_department(): void
    {
        $this->act()->postJson('/api/department-officer/courses', [
            'title'        => 'Introduction to Computing',
            'code'         => 'CSC101',
            'credit_units' => 3,
            'level'        => StudentLevel::Nce100->value,
            'semester'     => 'first',
        ])
            ->assertCreated()
            ->assertJsonPath('data.code', 'CSC101')
            ->assertJsonPath('data.department_id', $this->dept->id);
    }

    public function test_cannot_delete_course_with_assigned_lecturer(): void
    {
        $course   = Course::factory()->create(['school_id' => $this->school->id, 'department_id' => $this->dept->id]);
        $lecturer = User::factory()->role(UserRole::Lecturer)->create(['school_id' => $this->school->id, 'department_id' => $this->dept->id]);
        $course->lecturers()->attach($lecturer->id, ['session' => '2024/2025', 'semester' => 'first']);

        $this->act()->deleteJson("/api/department-officer/courses/{$course->id}")
            ->assertUnprocessable();
    }

    public function test_cannot_touch_course_in_another_department(): void
    {
        $otherDept = Department::factory()->create(['school_id' => $this->school->id]);
        $course    = Course::factory()->create(['school_id' => $this->school->id, 'department_id' => $otherDept->id]);

        $this->act()->getJson("/api/department-officer/courses/{$course->id}")
            ->assertForbidden();
    }

    // ── Lecturers ─────────────────────────────────────────────────────────────

    public function test_can_create_lecturer_scoped_to_department(): void
    {
        $this->act()->postJson('/api/department-officer/lecturers', [
            'file_number' => 'LEC/0001',
            'name'        => 'Dr. Adamu',
        ])
            ->assertCreated()
            ->assertJsonStructure(['user', 'temp_password']);

        $this->assertDatabaseHas('users', [
            'file_number'   => 'LEC/0001',
            'role'          => UserRole::Lecturer->value,
            'department_id' => $this->dept->id,
        ]);
    }

    public function test_can_reset_lecturer_password(): void
    {
        $lecturer = User::factory()->role(UserRole::Lecturer)->create(['school_id' => $this->school->id, 'department_id' => $this->dept->id]);

        $this->act()->postJson("/api/department-officer/lecturers/{$lecturer->id}/reset-password")
            ->assertOk()
            ->assertJsonStructure(['temp_password']);
    }

    // ── Assignments ───────────────────────────────────────────────────────────

    public function test_can_assign_lecturer_to_course(): void
    {
        $course   = Course::factory()->create(['school_id' => $this->school->id, 'department_id' => $this->dept->id]);
        $lecturer = User::factory()->role(UserRole::Lecturer)->create(['school_id' => $this->school->id, 'department_id' => $this->dept->id]);

        $this->act()->postJson("/api/department-officer/courses/{$course->id}/assign-lecturer", [
            'lecturer_id' => $lecturer->id,
            'session'     => '2024/2025',
            'semester'    => 'first',
        ])
            ->assertOk();

        $this->assertDatabaseHas('lecturer_courses', ['course_id' => $course->id, 'lecturer_id' => $lecturer->id]);
    }

    public function test_cannot_assign_lecturer_from_another_department(): void
    {
        $otherDept = Department::factory()->create(['school_id' => $this->school->id]);
        $course    = Course::factory()->create(['school_id' => $this->school->id, 'department_id' => $this->dept->id]);
        $outsider  = User::factory()->role(UserRole::Lecturer)->create(['school_id' => $this->school->id, 'department_id' => $otherDept->id]);

        $this->act()->postJson("/api/department-officer/courses/{$course->id}/assign-lecturer", [
            'lecturer_id' => $outsider->id,
            'session'     => '2024/2025',
            'semester'    => 'first',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('lecturer_id');
    }

    // ── Auto-enrolment on course creation ─────────────────────────────────────

    public function test_creating_a_course_enrols_existing_combination_students(): void
    {
        AcademicSession::factory()->current()->create(['school_id' => $this->school->id, 'session' => '2024/2025']);

        $combination = Combination::factory()->create(['school_id' => $this->school->id]);
        $combination->departments()->sync([$this->dept->id]);

        $student = Student::factory()->create([
            'school_id'      => $this->school->id,
            'combination_id' => $combination->id,
            'level'          => StudentLevel::Nce100->value,
        ]);

        $response = $this->act()->postJson('/api/department-officer/courses', [
            'title'        => 'Discrete Maths',
            'code'         => 'CSC111',
            'credit_units' => 2,
            'level'        => StudentLevel::Nce100->value,
            'semester'     => 'first',
        ])->assertCreated();

        $courseId = $response->json('data.id');
        $this->assertDatabaseHas('student_courses', ['student_id' => $student->id, 'course_id' => $courseId]);
    }

    // ── Student roster ────────────────────────────────────────────────────────

    public function test_student_roster_shows_only_students_in_departments_combinations(): void
    {
        $combination = Combination::factory()->create(['school_id' => $this->school->id]);
        $combination->departments()->sync([$this->dept->id]);

        Student::factory()->count(2)->create(['school_id' => $this->school->id, 'combination_id' => $combination->id]);
        // A student not in any combination of this department must not appear.
        Student::factory()->create(['school_id' => $this->school->id, 'combination_id' => null]);

        $this->act()->getJson('/api/department-officer/students')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }
}
