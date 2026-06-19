<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sync_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('direction', ['push', 'pull']);
            $table->enum('status', ['pending', 'success', 'failed'])->default('pending');
            $table->foreignId('initiated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('target_server_url')->nullable();
            $table->json('payload_summary')->nullable(); // counts/metadata only, never full payload
            $table->timestamp('synced_at')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();

            $table->index(['direction', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sync_logs');
    }
};
