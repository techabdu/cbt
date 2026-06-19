<?php

namespace Database\Seeders;

use App\Models\SystemSetting;
use Illuminate\Database\Seeder;

class SystemSettingsSeeder extends Seeder
{
    public function run(): void
    {
        $defaults = [
            'current_session' => '2023/2024',
            'current_semester' => 'first',
        ];

        foreach ($defaults as $key => $value) {
            SystemSetting::set($key, $value);
        }
    }
}
