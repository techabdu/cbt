<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The expiry sweeper polls for open sessions every minute; this keeps
        // that scan indexed once the online server accumulates history.
        Schema::table('exam_sessions', function (Blueprint $table) {
            $table->index(['submitted_at', 'started_at']);
        });
    }

    public function down(): void
    {
        Schema::table('exam_sessions', function (Blueprint $table) {
            $table->dropIndex(['submitted_at', 'started_at']);
        });
    }
};
