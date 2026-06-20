<?php

namespace App\Http\Controllers\Lecturer;

use App\Http\Controllers\Controller;
use App\Http\Resources\CourseResource;
use App\Models\Course;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CourseController extends Controller
{
    /**
     * Courses the authenticated lecturer is assigned to. Each row carries the
     * session + semester from the assignment pivot so the question-bank form can
     * pre-fill them.
     */
    public function index(Request $request): JsonResponse
    {
        $lecturer = $request->user();

        $courses = Course::query()
            ->with('department')
            ->whereHas('lecturers', fn ($q) => $q->where('lecturer_id', $lecturer->id))
            ->with(['lecturers' => fn ($q) => $q->where('lecturer_id', $lecturer->id)])
            ->orderBy('title')
            ->get();

        // Flatten the pivot assignments so the client sees one entry per
        // course/session/semester combination the lecturer teaches.
        $assignments = $courses->flatMap(function (Course $course) {
            return $course->lecturers->map(fn ($lec) => [
                'course'   => new CourseResource($course),
                'session'  => $lec->pivot->session,
                'semester' => $lec->pivot->semester,
            ]);
        })->values();

        return response()->json(['data' => $assignments]);
    }
}
