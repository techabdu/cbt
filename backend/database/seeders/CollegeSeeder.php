<?php

namespace Database\Seeders;

use App\Models\College;
use Illuminate\Database\Seeder;

class CollegeSeeder extends Seeder
{
    public function run(): void
    {
        // Singleton college record; Super Admin edits these details in-app.
        College::query()->firstOrCreate(
            ['id' => 1],
            [
                'name' => 'College of Education',
                'contact_email' => 'info@college.edu.ng',
                'contact_phone' => '+234',
                'address' => 'Nigeria',
            ]
        );
    }
}
