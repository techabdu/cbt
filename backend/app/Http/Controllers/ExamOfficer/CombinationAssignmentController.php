<?php

namespace App\Http\Controllers\ExamOfficer;

use App\Http\Controllers\Controller;
use App\Http\Requests\ExamOfficer\AssignStudentsToCombinationRequest;
use App\Http\Resources\StudentResource;
use App\Models\Combination;
use App\Models\Student;
use App\Services\AuditLogService;
use App\Services\CombinationEnrollmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CombinationAssignmentController extends Controller
{
    public function __construct(
        private readonly AuditLogService $auditLog,
        private readonly CombinationEnrollmentService $enrollment,
    ) {}

    /**
     * Students currently assigned to a combination.
     */
    public function students(Request $request, Combination $combination): JsonResponse
    {
        $this->guard($request, $combination->school_id);

        $students = $combination->students()
            ->orderBy('full_name')
            ->paginate($request->integer('per_page', 50))
            ->withQueryString();

        return StudentResource::collection($students)->response();
    }

    /**
     * Assign students to a combination, then auto-enrol each into every course
     * of the combination's departments at the student's level for the current
     * academic session.
     */
    public function assign(AssignStudentsToCombinationRequest $request, Combination $combination): JsonResponse
    {
        $schoolId = $request->attributes->get('school_id');
        $this->guard($request, $combination->school_id);

        $session = $this->enrollment->currentSession((int) $schoolId);
        if (! $session) {
            return response()->json([
                'message' => 'Set the academic calendar (current session) before assigning students.',
            ], 422);
        }

        $ids = $request->validated('student_ids');

        Student::whereIn('id', $ids)
            ->where('school_id', $schoolId)
            ->update(['combination_id' => $combination->id]);

        $created = $this->enrollment->enrolStudents($combination, $ids, $session);

        $this->auditLog->log(
            'students_assigned_to_combination', $request->user(),
            Combination::class, $combination->id,
            newValues: ['student_ids' => $ids, 'count' => count($ids), 'enrolments_created' => $created, 'session' => $session],
            ipAddress: $request->ip()
        );

        return response()->json([
            'message'            => count($ids) . ' student(s) assigned to ' . $combination->code . '.',
            'enrolments_created' => $created,
        ]);
    }

    /**
     * Remove a student from a combination. Historical enrolments are preserved.
     */
    public function remove(Request $request, Combination $combination, Student $student): JsonResponse
    {
        $this->guard($request, $combination->school_id);

        if ($student->combination_id === $combination->id) {
            $student->update(['combination_id' => null]);
        }

        $this->auditLog->log(
            'student_removed_from_combination', $request->user(),
            Combination::class, $combination->id,
            oldValues: ['student_id' => $student->id],
            ipAddress: $request->ip()
        );

        return response()->json(null, 204);
    }

    private function guard(Request $request, int $combinationSchoolId): void
    {
        $schoolId = $request->attributes->get('school_id');
        if ($schoolId && $combinationSchoolId !== (int) $schoolId) {
            abort(403, 'Access denied.');
        }
    }
}
