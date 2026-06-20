<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A Combination couples two (or more) atomic departments into the
        // combined NCE major a student reads, e.g. CSC/MAT. It is owned by the
        // School Exam Officer and is the canonical program a student belongs to.
        Schema::create('combinations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code'); // e.g. "CSC/MAT"
            $table->timestamps();

            $table->unique(['school_id', 'code']);
        });

        // The atomic departments a combination is built from.
        Schema::create('combination_department', function (Blueprint $table) {
            $table->id();
            $table->foreignId('combination_id')->constrained()->cascadeOnDelete();
            $table->foreignId('department_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['combination_id', 'department_id'], 'combination_department_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('combination_department');
        Schema::dropIfExists('combinations');
    }
};
