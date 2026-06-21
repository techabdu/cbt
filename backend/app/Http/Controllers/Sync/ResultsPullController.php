<?php

namespace App\Http\Controllers\Sync;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Services\SyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Runs on the OFFLINE server. Exposes the results package (sessions, answers,
 * results) for an exam so the online server can pull them. Delegates to
 * SyncService (shared with the file-export and network-push paths).
 */
class ResultsPullController extends Controller
{
    public function show(Request $request, Exam $exam, SyncService $sync): JsonResponse
    {
        return response()->json($sync->buildResultsPackage($exam));
    }
}
