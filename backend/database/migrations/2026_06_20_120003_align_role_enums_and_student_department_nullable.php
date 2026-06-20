<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The Department Exam Officer tier was added by editing existing migrations,
 * which also (a) extended the users.role and role_upgrades enums with
 * 'department_exam_officer' and (b) relaxed students.department_id to nullable
 * (combination_id is now the primary program link). Databases migrated before
 * those edits never received the changes, so role changes truncate and
 * combination-only student registration fails the NOT NULL constraint.
 *
 * MySQL only: SQLite/Postgres test databases store enums as text and apply the
 * edited definitions directly on a fresh migrate, so there is nothing to align.
 * The MODIFY statements are idempotent — re-applying the same definitions on an
 * already-correct database is a harmless no-op.
 */
return new class extends Migration
{
    private const ROLES = "'super_admin','cbt_admin','exam_officer','department_exam_officer','lecturer'";

    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement('ALTER TABLE users MODIFY role ENUM(' . self::ROLES . ') NOT NULL');
        DB::statement('ALTER TABLE role_upgrades MODIFY from_role ENUM(' . self::ROLES . ') NOT NULL');
        DB::statement('ALTER TABLE role_upgrades MODIFY to_role ENUM(' . self::ROLES . ') NOT NULL');

        // Relax the legacy NOT NULL on students.department_id (FK is preserved).
        DB::statement('ALTER TABLE students MODIFY department_id BIGINT UNSIGNED NULL');
    }

    public function down(): void
    {
        // Non-reversible by design: narrowing the enums or re-imposing NOT NULL
        // could orphan existing department officers / combination-only students.
    }
};
