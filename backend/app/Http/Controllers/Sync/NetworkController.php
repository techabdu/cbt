<?php

namespace App\Http\Controllers\Sync;

use App\Enums\ExamStatus;
use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Services\SyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Runs on the ONLINE server, authenticated by the shared X-Sync-Secret header.
 * The inverse of the LAN flow: here the OFFLINE server initiates — it pulls an
 * exam package from `exam-package`, and pushes results back to `receive-results`
 * — for the cloud-online + isolated-offline topology where the online server
 * cannot reach the exam-hall LAN.
 */
class NetworkController extends Controller
{
    public function __construct(private readonly SyncService $sync) {}

    /** Offline pulls a full exam package. */
    public function examPackage(Request $request, Exam $exam, SyncService $sync): JsonResponse
    {
        if ($exam->codes()->count() === 0) {
            abort(422, 'Generate exam codes before this exam can be pulled.');
        }

        $payload = $sync->buildExamPayload($exam);

        if (in_array($exam->status, [ExamStatus::Scheduled, ExamStatus::Synced], true)) {
            $exam->update(['status' => ExamStatus::Synced]);
        }

        return response()->json($payload);
    }

    /** Offline pushes an exam's results back up. */
    public function receiveResults(Request $request, Exam $exam, SyncService $sync): JsonResponse
    {
        $counts = $sync->applyResults($exam, $request->all());

        return response()->json(['received' => true] + $counts);
    }
}
