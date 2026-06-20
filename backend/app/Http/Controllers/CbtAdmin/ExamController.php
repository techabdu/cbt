<?php

namespace App\Http\Controllers\CbtAdmin;

use App\Http\Controllers\Controller;
use App\Http\Requests\CbtAdmin\StoreExamRequest;
use App\Http\Requests\CbtAdmin\UpdateExamRequest;
use App\Http\Resources\ExamResource;
use App\Models\Exam;
use App\Services\ExamCodeGeneratorService;
use App\Services\ExamConfigurationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class ExamController extends Controller
{
    public function __construct(
        private readonly ExamConfigurationService $config,
        private readonly ExamCodeGeneratorService $codes,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $exams = QueryBuilder::for(Exam::class)
            ->with(['course.department', 'questionBank', 'configuredBy'])
            ->withCount('codes')
            ->allowedFilters(
                AllowedFilter::exact('status'),
                AllowedFilter::exact('course_id'),
                AllowedFilter::callback('search', fn ($q, $v) => $q->whereHas('course',
                    fn ($c) => $c->where('title', 'like', "%{$v}%")->orWhere('code', 'like', "%{$v}%"))
                )
            )
            ->allowedSorts('exam_date', 'created_at', 'status')
            ->defaultSort('-exam_date')
            ->paginate($request->integer('per_page', 25))
            ->withQueryString();

        return ExamResource::collection($exams)->response();
    }

    public function store(StoreExamRequest $request): JsonResponse
    {
        $exam = $this->config->create($request->validated(), $request->user(), $request->ip());
        $exam->load(['course.department', 'questionBank', 'configuredBy'])->loadCount('codes');

        return (new ExamResource($exam))->response()->setStatusCode(201);
    }

    public function show(Exam $exam): JsonResponse
    {
        $exam->load(['course.department', 'questionBank.course', 'configuredBy'])->loadCount('codes');
        $exam->eligible_count = $this->codes->eligibleStudents($exam)->count();

        return (new ExamResource($exam))->response();
    }

    public function update(UpdateExamRequest $request, Exam $exam): JsonResponse
    {
        $this->config->update($exam, $request->validated(), $request->user(), $request->ip());
        $exam->load(['course.department', 'questionBank', 'configuredBy'])->loadCount('codes');

        return (new ExamResource($exam))->response();
    }

    public function destroy(Request $request, Exam $exam): JsonResponse
    {
        $this->config->delete($exam, $request->user(), $request->ip());

        return response()->json(null, 204);
    }
}
