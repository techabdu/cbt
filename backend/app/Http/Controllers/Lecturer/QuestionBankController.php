<?php

namespace App\Http\Controllers\Lecturer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Lecturer\StoreQuestionBankRequest;
use App\Http\Requests\Lecturer\UpdateQuestionBankRequest;
use App\Http\Resources\QuestionBankResource;
use App\Models\QuestionBank;
use App\Services\QuestionBankService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class QuestionBankController extends Controller
{
    public function __construct(private readonly QuestionBankService $service) {}

    public function index(Request $request): JsonResponse
    {
        $lecturer = $request->user();

        $banks = QueryBuilder::for(QuestionBank::class)
            ->where('lecturer_id', $lecturer->id)
            ->with('course.department')
            ->allowedFilters(
                AllowedFilter::exact('status'),
                AllowedFilter::exact('course_id'),
                AllowedFilter::callback('search', fn ($q, $v) => $q->where(
                    fn ($q) => $q->where('title', 'like', "%{$v}%")
                               ->orWhereHas('course', fn ($c) => $c->where('title', 'like', "%{$v}%")
                                                                   ->orWhere('code', 'like', "%{$v}%"))
                ))
            )
            ->allowedSorts('created_at', 'updated_at', 'status', 'total_questions')
            ->defaultSort('-updated_at')
            ->paginate($request->integer('per_page', 25))
            ->withQueryString();

        return QuestionBankResource::collection($banks)->response();
    }

    public function store(StoreQuestionBankRequest $request): JsonResponse
    {
        $bank = $this->service->createBank($request->user(), $request->validated(), $request->ip());
        $bank->load('course.department');

        return (new QuestionBankResource($bank))->response()->setStatusCode(201);
    }

    public function show(Request $request, QuestionBank $questionBank): JsonResponse
    {
        $this->authorizeOwner($request, $questionBank);

        $questionBank->load([
            'course.department',
            'reviewer',
            'questions' => fn ($q) => $q->with(['options', 'answers'])->orderBy('order_index'),
        ]);

        return (new QuestionBankResource($questionBank))->response();
    }

    public function update(UpdateQuestionBankRequest $request, QuestionBank $questionBank): JsonResponse
    {
        $this->authorizeOwner($request, $questionBank);

        $this->service->updateBank($questionBank, $request->validated(), $request->user(), $request->ip());
        $questionBank->load('course.department');

        return (new QuestionBankResource($questionBank))->response();
    }

    public function destroy(Request $request, QuestionBank $questionBank): JsonResponse
    {
        $this->authorizeOwner($request, $questionBank);

        if (! $questionBank->status->isEditable()) {
            return response()->json([
                'message' => 'Only draft or rejected question banks can be deleted.',
            ], 422);
        }

        $questionBank->delete();

        return response()->json(null, 204);
    }

    public function submit(Request $request, QuestionBank $questionBank): JsonResponse
    {
        $this->authorizeOwner($request, $questionBank);

        $this->service->submit($questionBank, $request->user(), $request->ip());
        $questionBank->load('course.department');

        return (new QuestionBankResource($questionBank))->response();
    }

    private function authorizeOwner(Request $request, QuestionBank $bank): void
    {
        if ($bank->lecturer_id !== $request->user()->id) {
            abort(404);
        }
    }
}
