<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('question_banks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lecturer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->string('title')->nullable();
            $table->string('session', 9); // e.g. "2023/2024"
            $table->enum('semester', ['first', 'second']);
            $table->unsignedSmallInteger('total_questions')->default(0);
            $table->enum('status', ['draft', 'submitted', 'under_review', 'approved', 'rejected'])
                ->default('draft');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();

            $table->index(['status', 'course_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('question_banks');
    }
};
