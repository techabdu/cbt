<?php

namespace App\Http\Controllers\Sync;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Runs on the OFFLINE server. Receives an exam payload pushed from the online
 * server and rebuilds the full graph (preserving primary keys) inside a single
 * transaction so a partial import can never leave the offline DB inconsistent.
 */
class PushReceiveController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->all();

        DB::transaction(function () use ($data): void {
            $now = now();

            // Order matters: every upsert respects foreign-key dependencies.
            $this->upsert('colleges', $data['colleges'] ?? [], $now);
            $this->upsert('schools', $data['schools'] ?? [], $now);
            $this->upsert('departments', $data['departments'] ?? [], $now);

            if (! empty($data['lecturer'])) {
                $lecturer = $data['lecturer'];
                // The offline lecturer record exists only to satisfy FKs; it is
                // never logged into, so the password is an unusable placeholder.
                $lecturer['password'] = bcrypt(Str::random(40));
                $lecturer['is_active'] = true;
                $lecturer['force_password_change'] = false;
                $this->upsert('users', [$lecturer], $now);
            }

            $this->upsert('courses', [$data['course']], $now);
            $this->upsert('question_banks', [$data['question_bank']], $now);

            $questions = [];
            $options   = [];
            $answers   = [];
            foreach ($data['questions'] ?? [] as $q) {
                $options = array_merge($options, $q['options'] ?? []);
                $answers = array_merge($answers, $q['answers'] ?? []);
                unset($q['options'], $q['answers']);
                $questions[] = $q;
            }
            $this->upsert('questions', $questions, $now);
            $this->upsert('question_options', $options, $now);
            $this->upsert('question_answers', $answers, $now);

            $this->upsert('students', $data['students'] ?? [], $now);
            $this->upsert('exams', [$data['exam']], $now);
            $this->upsert('exam_codes', $data['exam_codes'] ?? [], $now, ['generated_at' => $now]);
        });

        return response()->json([
            'received'   => true,
            'exam_id'    => $data['exam']['id'] ?? null,
            'questions'  => count($data['questions'] ?? []),
            'codes'      => count($data['exam_codes'] ?? []),
        ]);
    }

    /**
     * Insert-or-update a batch of rows by primary key, stamping timestamps.
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @param  array<string, mixed>  $extra  additional columns to force on each row
     */
    private function upsert(string $table, array $rows, \DateTimeInterface $now, array $extra = []): void
    {
        if (empty($rows)) {
            return;
        }

        $prepared = array_map(function (array $row) use ($now, $extra) {
            return array_merge($row, $extra, [
                'created_at' => $row['created_at'] ?? $now,
                'updated_at' => $now,
            ]);
        }, $rows);

        $columns = array_keys($prepared[0]);
        $update  = array_values(array_diff($columns, ['id', 'created_at']));

        DB::table($table)->upsert($prepared, ['id'], $update);
    }
}
