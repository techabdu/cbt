<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Holds the correct answer text for fill-in-the-blank (and optionally True/False)
        // questions. Multiple rows per question allow several acceptable answer variants;
        // matching is case-insensitive and trimmed at grading time.
        Schema::create('question_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('question_id')->constrained()->cascadeOnDelete();
            $table->string('correct_answer');
            $table->timestamps();

            $table->index('question_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('question_answers');
    }
};
