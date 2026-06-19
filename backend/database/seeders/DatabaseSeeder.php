<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * Order matters: system settings and the college come first, then the
     * bootstrap super-admin account. Domain data (schools, departments, users,
     * students, courses) is created through the app by the Super Admin and Exam
     * Officers, so it is not seeded here.
     */
    public function run(): void
    {
        $this->call([
            SystemSettingsSeeder::class,
            CollegeSeeder::class,
            SuperAdminSeeder::class,
        ]);
    }
}
