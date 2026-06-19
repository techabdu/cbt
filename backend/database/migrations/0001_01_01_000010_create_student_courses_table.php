<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('student_courses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->string('session', 9); // e.g. "2023/2024"
            $table->enum('semester', ['first', 'second']);
            $table->timestamps();

            $table->unique(['student_id', 'course_id', 'session', 'semester'], 'student_course_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_courses');
    }
};
