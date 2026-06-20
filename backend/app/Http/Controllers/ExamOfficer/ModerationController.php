<?php

namespace App\Http\Controllers\ExamOfficer;

use App\Enums\QuestionBankStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\ExamOfficer\RejectQuestionBankRequest;
use App\Http\Resources\QuestionBankResource;
use App\Models\QuestionBank;
use App\Services\ModerationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class ModerationController extends Controller
{
    public function __construct(private readonly ModerationService $service) {}

    /**
     * List question banks for courses in the officer's school. Defaults to the
     * moderation queue (submitted / under review) but the status filter allows
     * viewing approved/rejected history too.
     */
    public function index(Request $request): JsonResponse
    {
        $schoolId = $request->attributes->get('school_id');

        $banks = QueryBuilder::for(QuestionBank::class)
            ->whereHas('course', fn ($q) => $q->where('school_id', $schoolId))
            // Only banks that have actually been sent for moderation are visible.
            ->whereIn('status', [
                QuestionBankStatus::Submitted->value,
                QuestionBankStatus::UnderReview->value,
                QuestionBankStatus::Approved->value,
                QuestionBankStatus::Rejected->value,
            ])
            ->with(['course.department', 'lecturer'])
            ->allowedFilters(
                AllowedFilter::exact('status'),
                AllowedFilter::exact('course_id'),
                AllowedFilter::callback('search', fn ($q, $v) => $q->where(
                    fn ($q) => $q->where('title', 'like', "%{$v}%")
                               ->orWhereHas('course', fn ($c) => $c->where('title', 'like', "%{$v}%")
                                                                   ->orWhere('code', 'like', "%{$v}%"))
                               ->orWhereHas('lecturer', fn ($l) => $l->where('name', 'like', "%{$v}%"))
                ))
            )
            ->allowedSorts('submitted_at', 'reviewed_at', 'status', 'total_questions')
            ->defaultSort('submitted_at')
            ->paginate($request->integer('per_page', 25))
            ->withQueryString();

        return QuestionBankResource::collection($banks)->response();
    }

    /**
     * View a bank's full contents for review. Opening a submitted bank moves it
     * into the "under review" state.
     */
    public function show(Request $request, QuestionBank $questionBank): JsonResponse
    {
        $this->guard($request, $questionBank);

        if ($questionBank->status === QuestionBankStatus::Submitted) {
            $this->service->startReview($questionBank, $request->user(), $request->ip());
            $questionBank->refresh();
        }

        $questionBank->load([
            'course.department',
            'lecturer',
            'reviewer',
            'questions' => fn ($q) => $q->with(['options', 'answers'])->orderBy('order_index'),
        ]);

        return (new QuestionBankResource($questionBank))->response();
    }

    public function approve(Request $request, QuestionBank $questionBank): JsonResponse
    {
        $this->guard($request, $questionBank);

        $this->service->approve($questionBank, $request->user(), $request->ip());
        $questionBank->load(['course.department', 'lecturer', 'reviewer']);

        return (new QuestionBankResource($questionBank))->response();
    }

    public function reject(RejectQuestionBankRequest $request, QuestionBank $questionBank): JsonResponse
    {
        $this->guard($request, $questionBank);

        $this->service->reject($questionBank, $request->user(), $request->validated('reason'), $request->ip());
        $questionBank->load(['course.department', 'lecturer', 'reviewer']);

        return (new QuestionBankResource($questionBank))->response();
    }

    /**
     * Ensure the bank belongs to a course in the officer's school.
     */
    private function guard(Request $request, QuestionBank $bank): void
    {
        $schoolId = $request->attributes->get('school_id');
        if ($schoolId && $bank->course?->school_id !== (int) $schoolId) {
            abort(404);
        }
    }
}
