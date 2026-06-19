<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('students', function (Blueprint $table) {
            $table->id();
            $table->string('matric_number')->unique();
            $table->string('full_name');
            $table->foreignId('department_id')->constrained()->cascadeOnDelete();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->enum('level', ['NCE_100', 'NCE_200', 'NCE_300', 'Spillover_I', 'Spillover_II']);
            $table->string('photo_path')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['school_id', 'department_id', 'level']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('students');
    }
};
