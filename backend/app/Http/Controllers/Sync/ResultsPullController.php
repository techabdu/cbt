<?php

namespace App\Http\Controllers\Sync;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Runs on the OFFLINE server.
 * Exposes exam_sessions, student_answers and exam_results for a given exam
 * so the online server can pull them after the exam concludes.
 */
class ResultsPullController extends Controller
{
    public function show(Request $request, Exam $exam): JsonResponse
    {
        $sessions = ExamSession::with('answers')
            ->where('exam_id', $exam->id)
            ->whereNotNull('submitted_at')
            ->get();

        $results = \App\Models\ExamResult::where('exam_id', $exam->id)->get();

        return response()->json([
            'exam_id'       => $exam->id,
            'sessions'      => $sessions->map(fn ($s) => [
                'id'               => $s->id,
                'exam_id'          => $s->exam_id,
                'student_id'       => $s->student_id,
                'started_at'       => $s->started_at?->toIso8601String(),
                'submitted_at'     => $s->submitted_at?->toIso8601String(),
                'is_auto_submitted' => (bool) $s->is_auto_submitted,
                'answers'          => $s->answers->map(fn ($a) => [
                    'id'              => $a->id,
                    'exam_session_id' => $a->exam_session_id,
                    'question_id'     => $a->question_id,
                    'student_answer'  => $a->student_answer,
                    'is_correct'      => (bool) $a->is_correct,
                    'marks_earned'    => (float) $a->marks_earned,
                    'order_index'     => $a->order_index,
                ])->all(),
            ])->all(),
            'results'       => $results->map(fn ($r) => [
                'id'          => $r->id,
                'exam_id'     => $r->exam_id,
                'student_id'  => $r->student_id,
                'total_score' => (float) $r->total_score,
                'total_marks' => (float) $r->total_marks,
                'percentage'  => (float) $r->percentage,
                'grade'       => $r->grade,
                'is_absent'   => (bool) $r->is_absent,
            ])->all(),
        ]);
    }
}
