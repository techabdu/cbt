<?php

namespace App\Http\Controllers\ExamOfficer;

use App\Http\Controllers\Controller;
use App\Http\Requests\ExamOfficer\SetSemesterRequest;
use App\Http\Requests\ExamOfficer\StoreAcademicSessionRequest;
use App\Http\Resources\AcademicSessionResource;
use App\Models\AcademicSession;
use App\Models\School;
use App\Services\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AcademicCalendarController extends Controller
{
    public function __construct(private readonly AuditLogService $auditLog) {}

    /**
     * The full calendar: every academic session plus the active session+semester.
     */
    public function index(Request $request): JsonResponse
    {
        $schoolId = $request->attributes->get('school_id');

        $sessions = AcademicSession::where('school_id', $schoolId)
            ->orderByDesc('session')
            ->get();

        $school = School::find($schoolId);

        return response()->json([
            'data'             => AcademicSessionResource::collection($sessions),
            'current_session'  => $sessions->firstWhere('is_current', true)?->session,
            'current_semester' => $school?->current_semester?->value,
        ]);
    }

    public function storeSession(StoreAcademicSessionRequest $request): JsonResponse
    {
        $schoolId  = $request->attributes->get('school_id');
        $makeCurrent = $request->boolean('is_current')
            || ! AcademicSession::where('school_id', $schoolId)->exists();

        $session = DB::transaction(function () use ($schoolId, $request, $makeCurrent) {
            if ($makeCurrent) {
                AcademicSession::where('school_id', $schoolId)->update(['is_current' => false]);
            }

            return AcademicSession::create([
                'school_id'  => $schoolId,
                'session'    => $request->validated('session'),
                'is_current' => $makeCurrent,
            ]);
        });

        $this->auditLog->log(
            'academic_session_created', $request->user(),
            AcademicSession::class, $session->id,
            newValues: ['session' => $session->session, 'is_current' => $session->is_current],
            ipAddress: $request->ip()
        );

        return (new AcademicSessionResource($session))->response()->setStatusCode(201);
    }

    public function setCurrentSession(Request $request, AcademicSession $academicSession): JsonResponse
    {
        $this->guard($request, $academicSession->school_id);

        DB::transaction(function () use ($academicSession) {
            AcademicSession::where('school_id', $academicSession->school_id)->update(['is_current' => false]);
            $academicSession->update(['is_current' => true]);
        });

        $this->auditLog->log(
            'academic_session_set_current', $request->user(),
            AcademicSession::class, $academicSession->id,
            newValues: ['session' => $academicSession->session],
            ipAddress: $request->ip()
        );

        return (new AcademicSessionResource($academicSession->fresh()))->response();
    }

    public function destroySession(Request $request, AcademicSession $academicSession): JsonResponse
    {
        $this->guard($request, $academicSession->school_id);

        if ($academicSession->is_current) {
            return response()->json([
                'message' => 'Cannot delete the current session. Set another session as current first.',
            ], 422);
        }

        $academicSession->delete();

        return response()->json(null, 204);
    }

    public function setSemester(SetSemesterRequest $request): JsonResponse
    {
        $schoolId = $request->attributes->get('school_id');
        $school   = School::findOrFail($schoolId);

        $school->update(['current_semester' => $request->validated('semester')]);

        $this->auditLog->log(
            'academic_semester_set', $request->user(),
            School::class, $school->id,
            newValues: ['current_semester' => $request->validated('semester')],
            ipAddress: $request->ip()
        );

        return response()->json(['current_semester' => $school->fresh()->current_semester?->value]);
    }

    private function guard(Request $request, int $sessionSchoolId): void
    {
        $schoolId = $request->attributes->get('school_id');
        if ($schoolId && $sessionSchoolId !== (int) $schoolId) {
            abort(403, 'Access denied.');
        }
    }
}
