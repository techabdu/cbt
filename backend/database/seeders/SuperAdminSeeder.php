<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SuperAdminSeeder extends Seeder
{
    /**
     * Bootstrap the first Super Admin. Credentials are configurable via env so
     * production deployments never ship a known default password. The account is
     * flagged to force a password change on first login.
     */
    public function run(): void
    {
        User::query()->updateOrCreate(
            ['file_number' => env('SUPER_ADMIN_FILE_NUMBER', 'ADMIN/0001')],
            [
                'name' => env('SUPER_ADMIN_NAME', 'Super Administrator'),
                'email' => env('SUPER_ADMIN_EMAIL', 'superadmin@college.edu.ng'),
                'password' => Hash::make(env('SUPER_ADMIN_PASSWORD', 'password')),
                'role' => UserRole::SuperAdmin,
                'school_id' => null,
                'is_active' => true,
                'force_password_change' => true,
            ]
        );
    }
}
