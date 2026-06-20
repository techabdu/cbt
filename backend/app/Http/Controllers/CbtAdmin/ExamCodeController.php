<?php

namespace App\Http\Controllers\CbtAdmin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ExamCodeResource;
use App\Models\Exam;
use App\Models\ExamCode;
use App\Services\ExamCodeGeneratorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class ExamCodeController extends Controller
{
    public function __construct(private readonly ExamCodeGeneratorService $generator) {}

    /**
     * List the codes already generated for an exam.
     */
    public function index(Request $request, Exam $exam): JsonResponse
    {
        $codes = QueryBuilder::for(ExamCode::where('exam_id', $exam->id))
            ->with('student')
            ->allowedFilters(
                AllowedFilter::exact('is_used'),
                AllowedFilter::callback('search', fn ($q, $v) => $q->whereHas('student',
                    fn ($s) => $s->where('full_name', 'like', "%{$v}%")->orWhere('matric_number', 'like', "%{$v}%"))
                )
            )
            ->defaultSort('id')
            ->paginate($request->integer('per_page', 50))
            ->withQueryString();

        return ExamCodeResource::collection($codes)->response();
    }

    /**
     * Generate codes for every eligible student who does not yet have one.
     */
    public function generate(Request $request, Exam $exam): JsonResponse
    {
        $created = $this->generator->generateForExam($exam, $request->user()->id, $request->ip());

        return response()->json([
            'created'     => $created,
            'total_codes' => $exam->codes()->count(),
            'message'     => $created === 0
                ? 'All eligible students already have a code.'
                : "{$created} code(s) generated.",
        ]);
    }
}
