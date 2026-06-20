<?php

namespace App\Http\Controllers\CbtAdmin;

use App\Enums\QuestionBankStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\QuestionBankResource;
use App\Models\QuestionBank;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

/**
 * Read-only view of approved question banks across all schools, from which the
 * CBT Admin configures exams.
 */
class QuestionBankController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $banks = QueryBuilder::for(QuestionBank::class)
            ->where('status', QuestionBankStatus::Approved->value)
            ->with(['course.department', 'lecturer'])
            ->withCount('questions')
            ->allowedFilters(
                AllowedFilter::exact('course_id'),
                AllowedFilter::callback('search', fn ($q, $v) => $q->where(
                    fn ($q) => $q->where('title', 'like', "%{$v}%")
                               ->orWhereHas('course', fn ($c) => $c->where('title', 'like', "%{$v}%")
                                                                   ->orWhere('code', 'like', "%{$v}%"))
                ))
            )
            ->allowedSorts('reviewed_at', 'total_questions')
            ->defaultSort('-reviewed_at')
            ->paginate($request->integer('per_page', 25))
            ->withQueryString();

        return QuestionBankResource::collection($banks)->response();
    }

    public function show(QuestionBank $questionBank): JsonResponse
    {
        abort_unless($questionBank->status === QuestionBankStatus::Approved, 404);

        $questionBank->load([
            'course.department',
            'lecturer',
            'questions' => fn ($q) => $q->with(['options', 'answers'])->orderBy('order_index'),
        ]);

        return (new QuestionBankResource($questionBank))->response();
    }
}
