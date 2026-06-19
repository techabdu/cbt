<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('student_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('question_id')->constrained()->cascadeOnDelete();
            $table->text('student_answer')->nullable();
            $table->boolean('is_correct')->default(false);
            $table->decimal('marks_earned', 6, 2)->default(0);
            // The position this question appeared in for this student (questions are
            // shuffled per student). Lets reviewers reconcile shuffled order.
            $table->unsignedSmallInteger('order_index')->default(0);
            $table->timestamps();

            $table->unique(['exam_session_id', 'question_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_answers');
    }
};
