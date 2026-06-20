<?php

namespace App\Http\Controllers\Lecturer;

use App\Http\Controllers\Controller;
use App\Http\Resources\ExamResource;
use App\Http\Resources\ExamResultResource;
use App\Models\Exam;
use App\Models\ExamResult;
use App\Services\ResultsExportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\QueryBuilder;

class ResultController extends Controller
{
    public function __construct(private readonly ResultsExportService $exporter) {}

    /**
     * Exams with results_synced status for the authenticated lecturer's courses.
     */
    public function index(Request $request): JsonResponse
    {
        $courseIds = $request->user()
            ->lecturerCourses()
            ->pluck('course_id');

        $exams = QueryBuilder::for(Exam::class)
            ->with('course')
            ->whereIn('course_id', $courseIds)
            ->where('status', 'results_synced')
            ->defaultSort('-exam_date')
            ->paginate($request->integer('per_page', 20))
            ->withQueryString();

        return ExamResource::collection($exams)->response();
    }

    /**
     * Per-student results for one exam (lecturer must teach the course).
     */
    public function show(Request $request, Exam $exam): JsonResponse
    {
        $this->authorizeExam($request, $exam);

        $exam->loadMissing('course', 'questionBank');

        $results = ExamResult::with('student')
            ->where('exam_id', $exam->id)
            ->orderBy('percentage', 'desc')
            ->paginate($request->integer('per_page', 50))
            ->withQueryString();

        return response()->json([
            'exam'    => new ExamResource($exam),
            'results' => ExamResultResource::collection($results),
        ]);
    }

    /**
     * Export as PDF.
     */
    public function exportPdf(Request $request, Exam $exam): mixed
    {
        $this->authorizeExam($request, $exam);
        $exam->loadMissing('course');

        return $this->exporter->exportPdf($exam);
    }

    /**
     * Export as Excel.
     */
    public function exportExcel(Request $request, Exam $exam): mixed
    {
        $this->authorizeExam($request, $exam);
        $exam->loadMissing('course');

        return $this->exporter->exportExcel($exam);
    }

    private function authorizeExam(Request $request, Exam $exam): void
    {
        $courseIds = $request->user()->lecturerCourses()->pluck('course_id');

        if (! $courseIds->contains($exam->course_id)) {
            abort(403, 'You are not assigned to teach this course.');
        }
    }
}
