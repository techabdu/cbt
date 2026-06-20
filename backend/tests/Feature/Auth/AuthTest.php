<?php

namespace Tests\Feature\Auth;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_returns_token_and_user(): void
    {
        $user = User::factory()->create([
            'file_number' => 'TEST/0001',
            'password'    => 'secret1234',
            'role'        => UserRole::Lecturer,
            'is_active'   => true,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'file_number' => 'TEST/0001',
            'password'    => 'secret1234',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'file_number', 'role']]);
    }

    public function test_login_fails_with_wrong_password(): void
    {
        User::factory()->create([
            'file_number' => 'TEST/0002',
            'password'    => 'secret1234',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'file_number' => 'TEST/0002',
            'password'    => 'wrongpassword',
        ]);

        $response->assertUnprocessable();
    }

    public function test_login_fails_for_inactive_user(): void
    {
        User::factory()->inactive()->create([
            'file_number' => 'TEST/0003',
            'password'    => 'secret1234',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'file_number' => 'TEST/0003',
            'password'    => 'secret1234',
        ]);

        $response->assertUnprocessable();
    }

    public function test_me_returns_authenticated_user(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('user.id', $user->id);
    }

    public function test_logout_revokes_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('active')->plainTextToken;

        $this->assertCount(1, $user->fresh()->tokens);

        $this->withToken($token)->postJson('/api/auth/logout')->assertOk();

        // The current token must be deleted from the DB
        $this->assertCount(0, $user->fresh()->tokens);
    }

    public function test_change_password_updates_force_flag(): void
    {
        $user = User::factory()->create([
            'password'              => 'OldPass123',
            'force_password_change' => true,
        ]);
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->putJson('/api/auth/change-password', [
                'current_password'          => 'OldPass123',
                'new_password'              => 'NewPass456!',
                'new_password_confirmation' => 'NewPass456!',
            ])
            ->assertOk();

        $this->assertFalse($user->fresh()->force_password_change);
    }

    public function test_change_password_fails_if_current_is_wrong(): void
    {
        $user = User::factory()->create(['password' => 'correct']);
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->putJson('/api/auth/change-password', [
                'current_password'          => 'wrong',
                'new_password'              => 'NewPass456!',
                'new_password_confirmation' => 'NewPass456!',
            ])
            ->assertUnprocessable();
    }

    public function test_unauthenticated_request_returns_401(): void
    {
        $this->getJson('/api/auth/me')->assertUnauthorized();
    }
}
