<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('exam_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->decimal('total_score', 6, 2)->default(0);
            $table->decimal('total_marks', 6, 2)->default(0);
            $table->decimal('percentage', 5, 2)->default(0);
            $table->string('grade', 2)->nullable();
            $table->boolean('is_absent')->default(false);
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();

            $table->unique(['exam_id', 'student_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exam_results');
    }
};
