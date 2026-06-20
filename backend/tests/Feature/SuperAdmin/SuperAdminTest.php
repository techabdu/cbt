<?php

namespace Tests\Feature\SuperAdmin;

use App\Enums\UserRole;
use App\Models\College;
use App\Models\School;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SuperAdminTest extends TestCase
{
    use RefreshDatabase;

    private function superAdmin(): User
    {
        return User::factory()->role(UserRole::SuperAdmin)->create();
    }

    private function actingAsSuper(): User
    {
        $admin = $this->superAdmin();
        $this->actingAs($admin, 'sanctum');

        return $admin;
    }

    public function test_lower_role_cannot_access_super_admin_routes(): void
    {
        $this->actingAs(User::factory()->role(UserRole::CbtAdmin)->create(), 'sanctum')
            ->getJson('/api/super-admin/schools')
            ->assertForbidden();
    }

    public function test_can_view_and_update_college(): void
    {
        $this->actingAsSuper();

        $this->getJson('/api/super-admin/college')->assertOk();

        $this->putJson('/api/super-admin/college', [
            'name'          => 'Federal College of Education',
            'contact_email' => 'info@fce.edu.ng',
        ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Federal College of Education');

        $this->assertDatabaseHas('colleges', ['name' => 'Federal College of Education']);
    }

    public function test_can_create_school(): void
    {
        $this->actingAsSuper();

        $this->postJson('/api/super-admin/schools', [
            'name'      => 'School of Sciences',
            'code'      => 'SCI',
            'head_name' => 'Dr. Bello',
        ])
            ->assertCreated()
            ->assertJsonPath('data.code', 'SCI');

        $this->assertDatabaseHas('schools', ['code' => 'SCI']);
    }

    public function test_school_code_must_be_unique(): void
    {
        $this->actingAsSuper();
        College::factory()->create();
        School::query()->create(['college_id' => College::first()->id, 'name' => 'X', 'code' => 'SCI']);

        $this->postJson('/api/super-admin/schools', ['name' => 'Y', 'code' => 'SCI'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('code');
    }

    public function test_can_update_school(): void
    {
        $this->actingAsSuper();
        $college = College::create(['name' => 'C']);
        $school = School::create(['college_id' => $college->id, 'name' => 'Old', 'code' => 'OLD']);

        $this->putJson("/api/super-admin/schools/{$school->id}", [
            'name' => 'New Name',
            'code' => 'NEW',
        ])->assertOk()->assertJsonPath('data.name', 'New Name');
    }

    public function test_cannot_delete_school_with_dependents(): void
    {
        $this->actingAsSuper();
        $college = College::create(['name' => 'C']);
        $school = School::create(['college_id' => $college->id, 'name' => 'S', 'code' => 'S1']);
        User::factory()->role(UserRole::Lecturer)->create(['school_id' => $school->id]);

        $this->deleteJson("/api/super-admin/schools/{$school->id}")
            ->assertUnprocessable();

        $this->assertDatabaseHas('schools', ['id' => $school->id]);
    }

    public function test_can_delete_empty_school(): void
    {
        $this->actingAsSuper();
        $college = College::create(['name' => 'C']);
        $school = School::create(['college_id' => $college->id, 'name' => 'S', 'code' => 'S2']);

        $this->deleteJson("/api/super-admin/schools/{$school->id}")->assertOk();
        $this->assertDatabaseMissing('schools', ['id' => $school->id]);
    }

    public function test_can_create_cbt_admin_and_get_temp_password(): void
    {
        $this->actingAsSuper();

        $response = $this->postJson('/api/super-admin/cbt-admins', [
            'file_number' => 'CBT/0001',
            'name'        => 'Jane Admin',
            'email'       => 'jane@college.edu.ng',
        ]);

        $response->assertCreated()
            ->assertJsonStructure(['user' => ['id', 'file_number'], 'temp_password'])
            ->assertJsonPath('user.role', 'cbt_admin');

        $this->assertDatabaseHas('users', [
            'file_number'           => 'CBT/0001',
            'role'                  => 'cbt_admin',
            'force_password_change' => true,
        ]);
    }

    public function test_can_deactivate_cbt_admin(): void
    {
        $this->actingAsSuper();
        $admin = User::factory()->role(UserRole::CbtAdmin)->create();

        $this->putJson("/api/super-admin/cbt-admins/{$admin->id}", [
            'name'      => $admin->name,
            'is_active' => false,
        ])->assertOk();

        $this->assertFalse($admin->fresh()->is_active);
    }

    public function test_can_reset_cbt_admin_password(): void
    {
        $this->actingAsSuper();
        $admin = User::factory()->role(UserRole::CbtAdmin)->create(['force_password_change' => false]);

        $this->postJson("/api/super-admin/cbt-admins/{$admin->id}/reset-password")
            ->assertOk()
            ->assertJsonStructure(['temp_password']);

        $this->assertTrue($admin->fresh()->force_password_change);
    }

    public function test_cannot_manage_non_cbt_admin_via_cbt_admin_routes(): void
    {
        $this->actingAsSuper();
        $lecturer = User::factory()->role(UserRole::Lecturer)->create();

        $this->putJson("/api/super-admin/cbt-admins/{$lecturer->id}", [
            'name'      => 'x',
            'is_active' => true,
        ])->assertNotFound();
    }

    public function test_audit_log_records_actions(): void
    {
        $this->actingAsSuper();

        $this->postJson('/api/super-admin/schools', ['name' => 'Audited', 'code' => 'AUD']);

        $this->getJson('/api/super-admin/audit-logs')
            ->assertOk()
            ->assertJsonFragment(['action' => 'school_created']);
    }
}
