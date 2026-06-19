<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('question_bank_id')->constrained()->cascadeOnDelete();
            $table->text('question_text');
            $table->enum('question_type', ['mcq', 'true_false', 'fill_blank']);
            $table->unsignedSmallInteger('marks')->default(1);
            $table->unsignedSmallInteger('order_index')->default(0);
            $table->timestamps();

            $table->index(['question_bank_id', 'order_index']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('questions');
    }
};
