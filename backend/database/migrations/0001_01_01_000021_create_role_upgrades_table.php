<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Audit history of CBT-Admin-driven role changes. The user's *current* role
        // always lives on users.role; this table is purely a historical record.
        Schema::create('role_upgrades', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('from_role', ['super_admin', 'cbt_admin', 'exam_officer', 'department_exam_officer', 'lecturer']);
            $table->enum('to_role', ['super_admin', 'cbt_admin', 'exam_officer', 'department_exam_officer', 'lecturer']);
            $table->foreignId('upgraded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('school_id')->nullable()->constrained()->nullOnDelete();
            $table->text('reason')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('role_upgrades');
    }
};
