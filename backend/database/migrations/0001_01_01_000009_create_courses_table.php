<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('courses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('department_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('code');
            $table->unsignedTinyInteger('credit_units')->default(2);
            $table->enum('level', ['NCE_100', 'NCE_200', 'NCE_300', 'Spillover_I', 'Spillover_II']);
            $table->enum('semester', ['first', 'second']);
            $table->timestamps();

            $table->unique(['school_id', 'code']);
            $table->index(['department_id', 'level', 'semester']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('courses');
    }
};
