<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The canonical program link for a student. Nullable: a student may be
        // registered before being assigned to a combination. Added here (after
        // the combinations table exists) so the FK target is present.
        Schema::table('students', function (Blueprint $table) {
            $table->foreignId('combination_id')->nullable()->after('department_id')
                ->constrained()->nullOnDelete();

            $table->index(['school_id', 'combination_id', 'level']);
        });
    }

    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->dropIndex(['school_id', 'combination_id', 'level']);
            $table->dropConstrainedForeignId('combination_id');
        });
    }
};
