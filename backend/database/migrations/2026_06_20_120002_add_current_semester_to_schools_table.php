<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The school's active semester (half of the academic calendar) was originally
 * added by editing the create_schools_table migration, so databases migrated
 * before that edit are missing the column. This idempotent migration adds it
 * where absent.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('schools', 'current_semester')) {
            return;
        }

        Schema::table('schools', function (Blueprint $table) {
            $table->enum('current_semester', ['first', 'second'])->nullable();
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('schools', 'current_semester')) {
            return;
        }

        Schema::table('schools', function (Blueprint $table) {
            $table->dropColumn('current_semester');
        });
    }
};
