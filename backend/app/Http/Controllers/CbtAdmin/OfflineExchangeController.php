<?php

namespace App\Http\Controllers\CbtAdmin;

use App\Enums\ExamStatus;
use App\Enums\SyncDirection;
use App\Enums\SyncStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\ExamResource;
use App\Models\Exam;
use App\Models\SyncLog;
use App\Services\SyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Http;

/**
 * Offline exam exchange for the cloud-online + isolated-offline topology, where
 * the online server cannot reach the exam-hall LAN. Two transports:
 *
 *  - FILE (air-gapped): online exports an exam-package file → carried on USB →
 *    imported on the offline server; after the exam, the offline server exports
 *    a results file → carried back → imported on the online server.
 *  - NETWORK (offline briefly online): the offline server pulls the package
 *    from, and pushes results back to, the online server itself.
 *
 * All four file actions and both network actions reuse SyncService's
 * transport-agnostic package builders/importers.
 */
class OfflineExchangeController extends Controller
{
    public function __construct(private readonly SyncService $sync) {}

    // ── FILE transport ────────────────────────────────────────────────────────

    /** Online → file. Download a self-contained exam package. */
    public function exportPackage(Request $request, Exam $exam): Response
    {
        if (! in_array($exam->status, [ExamStatus::Scheduled, ExamStatus::Synced], true)) {
            abort(422, 'Only scheduled exams can be exported.');
        }
        if ($exam->codes()->count() === 0) {
            abort(422, 'Generate exam codes before exporting.');
        }

        $payload = $this->sync->buildExamPayload($exam);
        $exam->update(['status' => ExamStatus::Synced]);

        $this->log($exam->id, SyncDirection::Push, 'file://exam-package', $request->user()?->id, [
            'questions' => count($payload['questions']),
            'students'  => count($payload['students']),
            'codes'     => count($payload['exam_codes']),
        ]);

        return $this->download($payload, $this->filename($exam, 'exam'));
    }

    /** File → offline. Import an uploaded exam package, rebuilding the graph. */
    public function importPackage(Request $request): JsonResponse
    {
        $data = $this->readJsonFile($request);
        if (empty($data['exam']['id'])) {
            abort(422, 'This file is not a valid exam package.');
        }

        $exam = $this->sync->importExamPackage($data);

        $this->log($exam->id, SyncDirection::Push, 'file://exam-package', $request->user()?->id, [
            'questions' => count($data['questions'] ?? []),
            'codes'     => count($data['exam_codes'] ?? []),
        ]);

        return response()->json([
            'message' => 'Exam package imported. Students can now sit this exam.',
            'exam'    => new ExamResource($exam->fresh()->load('course')),
        ]);
    }

    /** Offline → file. Download the results package after the exam. */
    public function exportResults(Request $request, Exam $exam): Response
    {
        $payload = $this->sync->buildResultsPackage($exam);

        $this->log($exam->id, SyncDirection::Pull, 'file://results', $request->user()?->id, [
            'sessions' => count($payload['sessions']),
            'results'  => count($payload['results']),
        ]);

        return $this->download($payload, $this->filename($exam, 'results'));
    }

    /** File → online. Import an uploaded results package. */
    public function importResults(Request $request, Exam $exam): JsonResponse
    {
        $data = $this->readJsonFile($request);
        if ((int) ($data['exam_id'] ?? 0) !== $exam->id) {
            abort(422, 'This results file is for a different exam.');
        }

        $counts = $this->sync->applyResults($exam, $data);

        $this->log($exam->id, SyncDirection::Pull, 'file://results', $request->user()?->id, $counts);

        return response()->json([
            'message' => 'Results imported. Lecturers can now view them.',
            'exam'    => new ExamResource($exam->fresh()->load('course')),
        ]);
    }

    // ── NETWORK transport (runs on the OFFLINE server) ─────────────────────────

    /** Offline pulls an exam package from the online server. */
    public function networkPull(Request $request): JsonResponse
    {
        $base = $this->onlineBaseUrl();
        if (! $base) {
            return response()->json(['message' => 'No online server URL is configured. Set ONLINE_SERVER_URL first.'], 422);
        }

        $request->validate(['exam_id' => ['required', 'integer']]);
        $examId = $request->integer('exam_id');

        try {
            $response = Http::withHeaders(['X-Sync-Secret' => (string) config('cbt.sync_secret_key')])
                ->timeout((int) config('cbt.sync_timeout', 30))
                ->retry((int) config('cbt.sync_retries', 3), 200)
                ->acceptJson()
                ->get($base.'/api/sync/exam-package/'.$examId);
            $response->throw();

            $exam = $this->sync->importExamPackage($response->json());
        } catch (\Throwable $e) {
            $this->log($examId, SyncDirection::Pull, $base, $request->user()?->id, null, SyncStatus::Failed, $e->getMessage());

            return response()->json(['message' => 'Pull failed: could not reach the online server.', 'error' => $e->getMessage()], 502);
        }

        $this->log($exam->id, SyncDirection::Pull, $base, $request->user()?->id, ['exam_id' => $exam->id]);

        return response()->json([
            'message' => 'Exam pulled from the online server. Students can now sit this exam.',
            'exam'    => new ExamResource($exam->fresh()->load('course')),
        ]);
    }

    /** Offline pushes an exam's results up to the online server. */
    public function networkPushResults(Request $request, Exam $exam): JsonResponse
    {
        $base = $this->onlineBaseUrl();
        if (! $base) {
            return response()->json(['message' => 'No online server URL is configured. Set ONLINE_SERVER_URL first.'], 422);
        }

        $payload = $this->sync->buildResultsPackage($exam);

        try {
            $response = Http::withHeaders(['X-Sync-Secret' => (string) config('cbt.sync_secret_key')])
                ->timeout((int) config('cbt.sync_timeout', 30))
                ->retry((int) config('cbt.sync_retries', 3), 200)
                ->acceptJson()
                ->post($base.'/api/sync/receive-results/'.$exam->id, $payload);
            $response->throw();
        } catch (\Throwable $e) {
            $this->log($exam->id, SyncDirection::Push, $base, $request->user()?->id, null, SyncStatus::Failed, $e->getMessage());

            return response()->json(['message' => 'Push failed: could not reach the online server.', 'error' => $e->getMessage()], 502);
        }

        $counts = ['sessions' => count($payload['sessions']), 'results' => count($payload['results'])];
        $this->log($exam->id, SyncDirection::Push, $base, $request->user()?->id, $counts);

        return response()->json(['message' => 'Results pushed to the online server.']);
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private function onlineBaseUrl(): string
    {
        return rtrim((string) config('cbt.online_server_url'), '/');
    }

    /** @param array<string, mixed> $payload */
    private function download(array $payload, string $name): Response
    {
        return response($payload === [] ? '{}' : json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), 200, [
            'Content-Type'        => 'application/json',
            'Content-Disposition' => 'attachment; filename="'.$name.'"',
        ]);
    }

    /** @return array<string, mixed> */
    private function readJsonFile(Request $request): array
    {
        $request->validate(['file' => ['required', 'file']]);
        $contents = $request->file('file')->get();
        $data = json_decode((string) $contents, true);

        if (! is_array($data)) {
            abort(422, 'The uploaded file is not valid JSON.');
        }

        return $data;
    }

    private function filename(Exam $exam, string $kind): string
    {
        $code    = $exam->course?->code ?? 'exam-'.$exam->id;
        $session = str_replace('/', '-', (string) $exam->session);

        return str($code.'-'.$kind.'-'.$session)->slug()->append('.json')->value();
    }

    /** @param array<string, mixed>|null $summary */
    private function log(?int $examId, SyncDirection $direction, string $target, ?int $userId, ?array $summary, SyncStatus $status = SyncStatus::Success, ?string $error = null): void
    {
        SyncLog::create([
            'exam_id'           => $examId,
            'direction'         => $direction,
            'status'            => $status,
            'initiated_by'      => $userId,
            'target_server_url' => $target,
            'payload_summary'   => $summary,
            'synced_at'         => $status === SyncStatus::Success ? now() : null,
            'error_message'     => $error,
        ]);
    }
}
