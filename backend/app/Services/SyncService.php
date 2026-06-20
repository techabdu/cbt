<?php

namespace App\Services;

use App\Enums\ExamStatus;
use App\Enums\SyncDirection;
use App\Enums\SyncStatus;
use App\Models\College;
use App\Models\Course;
use App\Models\Department;
use App\Models\Exam;
use App\Models\School;
use App\Models\Student;
use App\Models\SyncLog;
use App\Models\User;
use Illuminate\Support\Facades\Http;

class SyncService
{
    public function __construct(
        private readonly AuditLogService $auditLog,
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
        $url     = $baseUrl.'/api/sync/receive-exam';

        $log = SyncLog::create([
            'exam_id'           => $exam->id,
            'direction'         => SyncDirection::Push,
            'status'            => SyncStatus::Pending,
            'initiated_by'      => $actor->id,
            'target_server_url' => $url,
            'payload_summary'   => [
                'questions' => count($payload['questions']),
                'students'  => count($payload['students']),
                'codes'     => count($payload['exam_codes']),
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
                'status'        => SyncStatus::Failed,
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

        $course   = $exam->course;
        $bank     = $exam->questionBank;
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
            'colleges'      => $colleges->map->only(['id', 'name', 'logo_path', 'contact_email', 'contact_phone', 'address'])->all(),
            'schools'       => $schools->map->only(['id', 'college_id', 'name', 'code', 'head_name'])->all(),
            'departments'   => $departments->map->only(['id', 'school_id', 'name', 'code', 'full_name'])->all(),
            'lecturer'      => $lecturer ? [
                'id'          => $lecturer->id,
                'file_number' => $lecturer->file_number,
                'name'        => $lecturer->name,
                'email'       => $lecturer->email,
                'role'        => $lecturer->role->value,
                'school_id'   => $lecturer->school_id,
            ] : null,
            'course'        => $course->only(['id', 'school_id', 'department_id', 'title', 'code', 'credit_units', 'level', 'semester']),
            'question_bank' => [
                'id'          => $bank->id,
                'lecturer_id' => $bank->lecturer_id,
                'course_id'   => $bank->course_id,
                'title'       => $bank->title,
                'session'     => $bank->session,
                'semester'    => $bank->semester->value,
                'total_questions' => $bank->total_questions,
                'status'      => $bank->status->value,
            ],
            'questions'     => $bank->questions->map(fn ($q) => [
                'id'            => $q->id,
                'question_bank_id' => $q->question_bank_id,
                'question_text' => $q->question_text,
                'question_type' => $q->question_type->value,
                'marks'         => $q->marks,
                'order_index'   => $q->order_index,
                'options'       => $q->options->map->only(['id', 'question_id', 'option_label', 'option_text', 'is_correct'])->all(),
                'answers'       => $q->answers->map->only(['id', 'question_id', 'correct_answer'])->all(),
            ])->all(),
            'students'      => $students->map->only(['id', 'matric_number', 'full_name', 'department_id', 'school_id', 'level', 'is_active'])->all(),
            'exam'          => [
                'id'               => $exam->id,
                'course_id'        => $exam->course_id,
                'question_bank_id' => $exam->question_bank_id,
                'session'          => $exam->session,
                'semester'         => $exam->semester->value,
                'exam_date'        => $exam->exam_date->toDateString(),
                'start_time'       => $exam->start_time,
                'duration_minutes' => $exam->duration_minutes,
                'status'           => ExamStatus::Synced->value,
            ],
            'exam_codes'    => $exam->codes->map->only(['id', 'exam_id', 'student_id', 'code', 'is_used'])->all(),
        ];
    }
}
