<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('exams', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->foreignId('question_bank_id')->constrained()->cascadeOnDelete();
            $table->string('session', 9); // e.g. "2023/2024"
            $table->enum('semester', ['first', 'second']);
            $table->date('exam_date');
            $table->time('start_time');
            $table->unsignedSmallInteger('duration_minutes');
            $table->enum('status', ['scheduled', 'synced', 'ongoing', 'completed', 'results_synced'])
                ->default('scheduled');
            $table->foreignId('configured_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['status', 'exam_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exams');
    }
};
