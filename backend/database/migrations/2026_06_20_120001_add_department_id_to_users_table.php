<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The optional department attachment for staff (required for Department Exam
 * Officers and lecturers, optional for School Exam Officers) was originally
 * added by editing the create_users_table migration. Editing an already-run
 * migration does not re-apply it, so databases migrated before that edit are
 * missing the column. This idempotent migration adds it where absent.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('users', 'department_id')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('department_id')->nullable()->after('school_id')
                ->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('users', 'department_id')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('department_id');
        });
    }
};
