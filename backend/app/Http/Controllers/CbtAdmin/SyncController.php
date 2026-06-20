<?php

namespace App\Http\Controllers\CbtAdmin;

use App\Enums\ExamStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\ExamResource;
use App\Http\Resources\SyncLogResource;
use App\Models\Exam;
use App\Models\SyncLog;
use App\Services\SyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class SyncController extends Controller
{
    public function __construct(private readonly SyncService $sync) {}

    /**
     * Push a configured exam to the offline server.
     */
    public function push(Request $request, Exam $exam): JsonResponse
    {
        if (! config('cbt.offline_server_url')) {
            return response()->json([
                'message' => 'No offline server URL is configured. Set OFFLINE_SERVER_URL first.',
            ], 422);
        }

        if (! in_array($exam->status, [ExamStatus::Scheduled, ExamStatus::Synced], true)) {
            return response()->json([
                'message' => 'Only scheduled exams can be synced to the offline server.',
            ], 422);
        }

        if ($exam->codes()->count() === 0) {
            return response()->json([
                'message' => 'Generate exam codes before syncing to the offline server.',
            ], 422);
        }

        try {
            $log = $this->sync->pushToOffline($exam, $request->user(), $request->ip());
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Sync failed: could not reach the offline server.',
                'error'   => $e->getMessage(),
            ], 502);
        }

        return response()->json([
            'message' => 'Exam synced to the offline server.',
            'log'     => new SyncLogResource($log),
            'exam'    => new ExamResource($exam->fresh()->load('course')),
        ]);
    }

    /**
     * Sync activity log.
     */
    public function logs(Request $request): JsonResponse
    {
        $logs = QueryBuilder::for(SyncLog::class)
            ->with(['exam.course', 'initiatedBy'])
            ->allowedFilters(
                AllowedFilter::exact('direction'),
                AllowedFilter::exact('status'),
                AllowedFilter::exact('exam_id'),
            )
            ->defaultSort('-created_at')
            ->paginate($request->integer('per_page', 25))
            ->withQueryString();

        return SyncLogResource::collection($logs)->response();
    }
}
