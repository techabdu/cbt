<?php

namespace App\Http\Controllers\Sync;

use App\Http\Controllers\Controller;
use App\Services\SyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Runs on the OFFLINE server. Receives an exam payload pushed from the online
 * server over the LAN and rebuilds the full graph via SyncService (shared with
 * the file-import and network-pull paths).
 */
class PushReceiveController extends Controller
{
    public function store(Request $request, SyncService $sync): JsonResponse
    {
        $data = $request->all();
        $exam = $sync->importExamPackage($data);

        return response()->json([
            'received'  => true,
            'exam_id'   => $exam->id,
            'questions' => count($data['questions'] ?? []),
            'codes'     => count($data['exam_codes'] ?? []),
        ]);
    }
}
