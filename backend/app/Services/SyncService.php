<?php

namespace App\Services;

use App\Enums\ExamStatus;
use App\Enums\SyncDirection;
use App\Enums\SyncStatus;
use App\Models\College;
use App\Models\Course;
use App\Models\Department;
use App\Models\Exam;
use App\Models\ExamResult;
use App\Models\ExamSession;
use App\Models\LecturerCourse;
use App\Models\School;
use App\Models\Student;
use App\Models\StudentAnswer;
use App\Models\SyncLog;
use App\Models\User;
use App\Notifications\ExamResultsAvailable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class SyncService
{
    public function __construct(
        private readonly AuditLogService $auditLog,
        private readonly AutoGradingService $grading,
    ) {}

    /**
     * Push a fully-configured exam (questions, codes, roster and all referenced
     * structure) to the offline LAN server. Returns the SyncLog recording the
     * attempt. Throws on transport/HTTP failure after logging it.
     */
    public function pushToOffline(Exam $exam, User $actor, ?string $ip = null): SyncLog
    {
        $payload = $this->buildExamPayload($exam);
        $baseUrl = rtrim((string) config('cbt.offline_server_url'), '/');
        $url = $baseUrl.'/api/sync/receive-exam';

        $log = SyncLog::create([
            'exam_id' => $exam->id,
            'direction' => SyncDirection::Push,
            'status' => SyncStatus::Pending,
            'initiated_by' => $actor->id,
            'target_server_url' => $url,
            'payload_summary' => [
                'questions' => count($payload['questions']),
                'students' => count($payload['students']),
                'codes' => count($payload['exam_codes']),
            ],
        ]);

        try {
            $response = Http::withHeaders(['X-Sync-Secret' => (string) config('cbt.sync_secret_key')])
                ->timeout((int) config('cbt.sync_timeout', 30))
                ->retry((int) config('cbt.sync_retries', 3), 200)
                ->acceptJson()
                ->post($url, $payload);

            $response->throw();

            $exam->update(['status' => ExamStatus::Synced]);
            $log->update(['status' => SyncStatus::Success, 'synced_at' => now()]);

            $this->auditLog->log('exam_synced_to_offline', $actor, Exam::class, $exam->id,
                newValues: $log->payload_summary, ipAddress: $ip);
        } catch (\Throwable $e) {
            $log->update([
                'status' => SyncStatus::Failed,
                'error_message' => $e->getMessage(),
            ]);

            throw $e;
        }

        return $log;
    }

    /**
     * Pull exam_sessions, student_answers and exam_results from the offline
     * server, upsert them on the online server, mark the exam results_synced,
     * and fire notifications to all lecturers of the course.
     */
    public function pullFromOffline(Exam $exam, User $actor, ?string $ip = null): SyncLog
    {
        $baseUrl = rtrim((string) config('cbt.offline_server_url'), '/');
        $url = $baseUrl.'/api/sync/results/'.$exam->id;

        $log = SyncLog::create([
            'exam_id' => $exam->id,
            'direction' => SyncDirection::Pull,
            'status' => SyncStatus::Pending,
            'initiated_by' => $actor->id,
            'target_server_url' => $url,
            'payload_summary' => null,
        ]);

        try {
            $response = Http::withHeaders(['X-Sync-Secret' => (string) config('cbt.sync_secret_key')])
                ->timeout((int) config('cbt.sync_timeout', 30))
                ->acceptJson()
                ->get($url);

            $response->throw();

            $counts = $this->applyResults($exam, $response->json());

            $log->update([
                'status' => SyncStatus::Success,
                'synced_at' => now(),
                'payload_summary' => $counts,
            ]);

            $this->auditLog->log('results_pulled_from_offline', $actor, Exam::class, $exam->id,
                newValues: $counts, ipAddress: $ip);
        } catch (\Throwable $e) {
            $log->update([
                'status' => SyncStatus::Failed,
                'error_message' => $e->getMessage(),
            ]);

            throw $e;
        }

        return $log;
    }

    /**
     * Assemble the self-contained payload for an exam. Includes every referenced
     * row (college → school → department → lecturer → course → bank → questions
     * → students → codes) so the offline server can rebuild the graph from
     * scratch with the same primary keys.
     *
     * @return array<string, mixed>
     */
    public function buildExamPayload(Exam $exam): array
    {
        $exam->loadMissing([
            'course',
            'questionBank.lecturer',
            'questionBank.questions.options',
            'questionBank.questions.answers',
            'codes',
        ]);

        $course = $exam->course;
        $bank = $exam->questionBank;
        $lecturer = $bank->lecturer;

        $students = Student::whereIn('id', $exam->codes->pluck('student_id'))->get();

        $departmentIds = $students->pluck('department_id')
            ->push($course->department_id)
            ->filter()->unique()->values();
        $departments = Department::whereIn('id', $departmentIds)->get();

        $schoolIds = $departments->pluck('school_id')
            ->push($course->school_id)
            ->merge($students->pluck('school_id'))
            ->filter()->unique()->values();
        $schools = School::whereIn('id', $schoolIds)->get();

        $colleges = College::whereIn('id', $schools->pluck('college_id')->unique())->get();

        return [
            'colleges' => $colleges->map->only(['id', 'name', 'logo_path', 'contact_email', 'contact_phone', 'address'])->all(),
            'schools' => $schools->map->only(['id', 'college_id', 'name', 'code', 'head_name'])->all(),
            'departments' => $departments->map->only(['id', 'school_id', 'name', 'code', 'full_name'])->all(),
            'lecturer' => $lecturer ? [
                'id' => $lecturer->id,
                'file_number' => $lecturer->file_number,
                'name' => $lecturer->name,
                'email' => $lecturer->email,
                'role' => $lecturer->role->value,
                'school_id' => $lecturer->school_id,
            ] : null,
            'course' => $course->only(['id', 'school_id', 'department_id', 'title', 'code', 'credit_units', 'level', 'semester']),
            'question_bank' => [
                'id' => $bank->id,
                'lecturer_id' => $bank->lecturer_id,
                'course_id' => $bank->course_id,
                'title' => $bank->title,
                'session' => $bank->session,
                'semester' => $bank->semester->value,
                'total_questions' => $bank->total_questions,
                'status' => $bank->status->value,
            ],
            'questions' => $bank->questions->map(fn ($q) => [
                'id' => $q->id,
                'question_bank_id' => $q->question_bank_id,
                'question_text' => $q->question_text,
                'question_type' => $q->question_type->value,
                'marks' => $q->marks,
                'order_index' => $q->order_index,
                'options' => $q->options->map->only(['id', 'question_id', 'option_label', 'option_text', 'is_correct'])->all(),
                'answers' => $q->answers->map->only(['id', 'question_id', 'correct_answer'])->all(),
            ])->all(),
            'students' => $students->map->only(['id', 'matric_number', 'full_name', 'department_id', 'school_id', 'level', 'is_active'])->all(),
            'exam' => [
                'id' => $exam->id,
                'course_id' => $exam->course_id,
                'question_bank_id' => $exam->question_bank_id,
                'session' => $exam->session,
                'semester' => $exam->semester->value,
                'exam_date' => $exam->exam_date->toDateString(),
                'start_time' => $exam->start_time,
                'duration_minutes' => $exam->duration_minutes,
                'status' => ExamStatus::Synced->value,
            ],
            'exam_codes' => $exam->codes->map->only(['id', 'exam_id', 'student_id', 'code', 'is_used'])->all(),
        ];
    }

    /**
     * Rebuild the full exam graph from a package (the array produced by
     * buildExamPayload), preserving primary keys. Transport-agnostic: used by
     * the LAN push receiver, the file import, and the network pull. Idempotent.
     */
    public function importExamPackage(array $data): Exam
    {
        return DB::transaction(function () use ($data): Exam {
            $now = now();

            // Order matters: every upsert respects foreign-key dependencies.
            $this->upsertRows('colleges', $data['colleges'] ?? [], $now);
            $this->upsertRows('schools', $data['schools'] ?? [], $now);
            $this->upsertRows('departments', $data['departments'] ?? [], $now);

            if (! empty($data['lecturer'])) {
                $lecturer = $data['lecturer'];
                // FK-only placeholder account; never logged into on the offline server.
                $lecturer['password'] = bcrypt(Str::random(40));
                $lecturer['is_active'] = true;
                $lecturer['force_password_change'] = false;
                $this->upsertRows('users', [$lecturer], $now);
            }

            $this->upsertRows('courses', [$data['course']], $now);
            $this->upsertRows('question_banks', [$data['question_bank']], $now);

            $questions = [];
            $options = [];
            $answers = [];
            foreach ($data['questions'] ?? [] as $q) {
                $options = array_merge($options, $q['options'] ?? []);
                $answers = array_merge($answers, $q['answers'] ?? []);
                unset($q['options'], $q['answers']);
                $questions[] = $q;
            }
            $this->upsertRows('questions', $questions, $now);
            $this->upsertRows('question_options', $options, $now);
            $this->upsertRows('question_answers', $answers, $now);

            $this->upsertRows('students', $data['students'] ?? [], $now);
            $this->upsertRows('exams', [$data['exam']], $now);
            $this->upsertRows('exam_codes', $data['exam_codes'] ?? [], $now, ['generated_at' => $now]);

            // A re-import can change the questions, so drop any cached payload for
            // this exam — students will get the fresh set on next login.
            ExamSessionService::forgetQuestionCache((int) $data['exam']['id']);

            return Exam::findOrFail($data['exam']['id']);
        });
    }

    /**
     * Assemble the results package (sessions + answers + results) for an exam on
     * the offline server. Used by the LAN pull endpoint, the file export, and
     * the network push.
     *
     * @return array<string, mixed>
     */
    public function buildResultsPackage(Exam $exam): array
    {
        // Safety net: grading is queued on submit, so a session could still be
        // ungraded if the worker pool hasn't drained. Grade any submitted session
        // with no result yet before the package leaves the offline server, so
        // results are never exported partial. Idempotent; a no-op once drained.
        $this->gradePendingSessions($exam);

        $sessions = ExamSession::with('answers')
            ->where('exam_id', $exam->id)
            ->whereNotNull('submitted_at')
            ->get();

        $results = ExamResult::where('exam_id', $exam->id)->get();

        return [
            'exam_id' => $exam->id,
            'sessions' => $sessions->map(fn ($s) => [
                'id' => $s->id,
                'exam_id' => $s->exam_id,
                'student_id' => $s->student_id,
                'started_at' => $s->started_at?->toIso8601String(),
                'submitted_at' => $s->submitted_at?->toIso8601String(),
                'is_auto_submitted' => (bool) $s->is_auto_submitted,
                'answers' => $s->answers->map(fn ($a) => [
                    'id' => $a->id,
                    'exam_session_id' => $a->exam_session_id,
                    'question_id' => $a->question_id,
                    'student_answer' => $a->student_answer,
                    'is_correct' => (bool) $a->is_correct,
                    'marks_earned' => (float) $a->marks_earned,
                    'order_index' => $a->order_index,
                ])->all(),
            ])->all(),
            'results' => $results->map(fn ($r) => [
                'id' => $r->id,
                'exam_id' => $r->exam_id,
                'student_id' => $r->student_id,
                'total_score' => (float) $r->total_score,
                'total_marks' => (float) $r->total_marks,
                'percentage' => (float) $r->percentage,
                'grade' => $r->grade,
                'is_absent' => (bool) $r->is_absent,
            ])->all(),
        ];
    }

    /**
     * Grade any submitted-but-ungraded sessions for the exam — the queue safety
     * net behind buildResultsPackage(). Only touches sessions that have no result
     * yet, and gradeSession() is idempotent, so this is safe to run repeatedly.
     */
    private function gradePendingSessions(Exam $exam): void
    {
        $gradedStudentIds = ExamResult::where('exam_id', $exam->id)->pluck('student_id')->all();

        ExamSession::where('exam_id', $exam->id)
            ->whereNotNull('submitted_at')
            ->when($gradedStudentIds, fn ($q) => $q->whereNotIn('student_id', $gradedStudentIds))
            ->get()
            ->each(fn (ExamSession $s) => $this->grading->gradeSession($s));
    }

    /**
     * Upsert a results package onto the online server, mark the exam
     * results_synced, and notify the course's lecturers. Transport-agnostic:
     * used by the LAN pull, the file import, and the network receive.
     *
     * @return array{sessions: int, results: int}
     */
    public function applyResults(Exam $exam, array $body): array
    {
        DB::transaction(function () use ($body, $exam): void {
            $now = now()->toDateTimeString();

            foreach ($body['sessions'] ?? [] as $s) {
                ExamSession::upsert([[
                    'id' => $s['id'],
                    'exam_id' => $s['exam_id'],
                    'student_id' => $s['student_id'],
                    'started_at' => $s['started_at'],
                    'submitted_at' => $s['submitted_at'],
                    'is_auto_submitted' => $s['is_auto_submitted'] ? 1 : 0,
                    'synced_at' => $now,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]], ['id'], ['submitted_at', 'is_auto_submitted', 'synced_at', 'updated_at']);

                foreach ($s['answers'] ?? [] as $a) {
                    StudentAnswer::upsert([[
                        'id' => $a['id'],
                        'exam_session_id' => $a['exam_session_id'],
                        'question_id' => $a['question_id'],
                        'student_answer' => $a['student_answer'],
                        'is_correct' => $a['is_correct'] ? 1 : 0,
                        'marks_earned' => $a['marks_earned'],
                        'order_index' => $a['order_index'],
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]], ['id'], ['student_answer', 'is_correct', 'marks_earned', 'updated_at']);
                }
            }

            foreach ($body['results'] ?? [] as $r) {
                ExamResult::upsert([[
                    'id' => $r['id'],
                    'exam_id' => $r['exam_id'],
                    'student_id' => $r['student_id'],
                    'total_score' => $r['total_score'],
                    'total_marks' => $r['total_marks'],
                    'percentage' => $r['percentage'],
                    'grade' => $r['grade'],
                    'is_absent' => $r['is_absent'] ? 1 : 0,
                    'synced_at' => $now,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]], ['id'], ['total_score', 'total_marks', 'percentage', 'grade', 'synced_at', 'updated_at']);
            }

            $exam->update(['status' => ExamStatus::ResultsSynced]);
        });

        $exam->loadMissing('course');
        if ($exam->course_id) {
            $lecturerIds = LecturerCourse::where('course_id', $exam->course_id)->pluck('lecturer_id');
            User::whereIn('id', $lecturerIds)->each(
                fn (User $u) => $u->notify(new ExamResultsAvailable($exam))
            );
        }

        return [
            'sessions' => count($body['sessions'] ?? []),
            'results' => count($body['results'] ?? []),
        ];
    }

    /**
     * Insert-or-update a batch of rows by primary key, stamping timestamps.
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @param  array<string, mixed>  $extra
     */
    private function upsertRows(string $table, array $rows, \DateTimeInterface $now, array $extra = []): void
    {
        if (empty($rows)) {
            return;
        }

        $prepared = array_map(fn (array $row) => array_merge($row, $extra, [
            'created_at' => $row['created_at'] ?? $now,
            'updated_at' => $now,
        ]), $rows);

        $columns = array_keys($prepared[0]);
        $update = array_values(array_diff($columns, ['id', 'created_at']));

        DB::table($table)->upsert($prepared, ['id'], $update);
    }
}
