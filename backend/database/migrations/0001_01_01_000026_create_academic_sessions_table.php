<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The academic calendar managed by the School Exam Officer. Exactly one
        // session per school is flagged is_current; paired with schools.current_semester
        // it forms the active calendar new enrolments/exams default to.
        Schema::create('academic_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('session', 9); // e.g. "2024/2025"
            $table->boolean('is_current')->default(false);
            $table->timestamps();

            $table->unique(['school_id', 'session']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('academic_sessions');
    }
};
