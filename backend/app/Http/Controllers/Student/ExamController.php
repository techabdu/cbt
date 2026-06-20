<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Http\Requests\Student\StudentLoginRequest;
use App\Models\ExamSession;
use App\Services\ExamSessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExamController extends Controller
{
    public function __construct(private readonly ExamSessionService $sessions) {}

    /**
     * Student login with matric number + exam code. Starts or resumes the session.
     */
    public function login(StudentLoginRequest $request): JsonResponse
    {
        $data = $this->sessions->login(
            $request->validated('matric_number'),
            $request->validated('exam_code'),
        );

        return response()->json($data);
    }

    /**
     * Resume payload for the token-authenticated session (F5 / reconnect).
     */
    public function resume(Request $request): JsonResponse
    {
        return response()->json($this->sessions->resume($this->session($request)));
    }

    /**
     * Save a single answer.
     */
    public function answer(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'question_id' => ['required', 'integer'],
            'answer'      => ['nullable', 'string', 'max:1000'],
            'order_index' => ['nullable', 'integer'],
        ]);

        $this->sessions->saveAnswer(
            $this->session($request),
            $validated['question_id'],
            $validated['answer'] ?? null,
            $validated['order_index'] ?? 0,
        );

        return response()->json(['saved' => true]);
    }

    /**
     * Bulk autosave (periodic background save).
     */
    public function autosave(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'answers'                 => ['required', 'array'],
            'answers.*.question_id'   => ['required', 'integer'],
            'answers.*.answer'        => ['nullable', 'string', 'max:1000'],
            'answers.*.order_index'   => ['nullable', 'integer'],
        ]);

        $this->sessions->saveAnswers($this->session($request), $validated['answers']);

        return response()->json(['saved' => true, 'at' => now()->toIso8601String()]);
    }

    /**
     * Submit the exam (manual or auto). Grades immediately on the offline server.
     */
    public function submit(Request $request): JsonResponse
    {
        $auto = $request->boolean('auto_submitted');

        return response()->json($this->sessions->submit($this->session($request), $auto));
    }

    private function session(Request $request): ExamSession
    {
        return $request->attributes->get('exam_session');
    }
}
