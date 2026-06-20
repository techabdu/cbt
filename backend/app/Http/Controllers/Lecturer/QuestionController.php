<?php

namespace App\Http\Controllers\Lecturer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Lecturer\StoreQuestionRequest;
use App\Http\Requests\Lecturer\UpdateQuestionRequest;
use App\Http\Resources\QuestionResource;
use App\Models\Question;
use App\Models\QuestionBank;
use App\Services\QuestionBankService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuestionController extends Controller
{
    public function __construct(private readonly QuestionBankService $service) {}

    public function store(StoreQuestionRequest $request, QuestionBank $questionBank): JsonResponse
    {
        $this->authorizeOwner($request, $questionBank);

        $question = $this->service->addQuestion($questionBank, $request->validated());

        return (new QuestionResource($question))->response()->setStatusCode(201);
    }

    public function update(UpdateQuestionRequest $request, QuestionBank $questionBank, Question $question): JsonResponse
    {
        $this->authorizeOwner($request, $questionBank);
        $this->assertBelongs($question, $questionBank);

        $question = $this->service->updateQuestion($question, $request->validated());

        return (new QuestionResource($question))->response();
    }

    public function destroy(Request $request, QuestionBank $questionBank, Question $question): JsonResponse
    {
        $this->authorizeOwner($request, $questionBank);
        $this->assertBelongs($question, $questionBank);

        $this->service->deleteQuestion($question);

        return response()->json(null, 204);
    }

    private function authorizeOwner(Request $request, QuestionBank $bank): void
    {
        if ($bank->lecturer_id !== $request->user()->id) {
            abort(404);
        }
    }

    private function assertBelongs(Question $question, QuestionBank $bank): void
    {
        if ($question->question_bank_id !== $bank->id) {
            abort(404);
        }
    }
}
