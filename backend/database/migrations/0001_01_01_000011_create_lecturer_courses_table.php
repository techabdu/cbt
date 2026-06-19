<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lecturer_courses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lecturer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->string('session', 9); // e.g. "2023/2024"
            $table->enum('semester', ['first', 'second']);
            $table->timestamps();

            $table->unique(['lecturer_id', 'course_id', 'session', 'semester'], 'lecturer_course_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lecturer_courses');
    }
};
