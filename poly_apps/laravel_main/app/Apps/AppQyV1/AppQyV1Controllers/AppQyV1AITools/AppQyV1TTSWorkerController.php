<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryTTSCoordinator;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DurableOffsetUploadService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

/**
 * External TTS worker surface (pycore).
 *
 * The intermediate tts_queue table is gone: workers claim pending WORD rows
 * directly from the canonical tts_cache_{lang} tables and report results
 * back. Every reported result is validated server-side (MP3 magic, size,
 * row identity, on-disk verification) before the canonical row is updated —
 * see AppQyV1DictionaryTTSCoordinator::reportWordResult.
 *
 * Routes (public group, same trust level as the existing queue endpoints):
 *   POST /api/app_qy_v1/ai_tools/tts/worker/claim
 *   POST /api/app_qy_v1/ai_tools/tts/worker/report
 */
class AppQyV1TTSWorkerController extends Controller
{
    private AppQyV1DictionaryTTSCoordinator $coordinator;
    private AppQyV1DurableOffsetUploadService $uploadService;

    public function __construct(?AppQyV1DurableOffsetUploadService $uploadService = null)
    {
        $this->coordinator = new AppQyV1DictionaryTTSCoordinator();
        $this->uploadService = $uploadService ?: new AppQyV1DurableOffsetUploadService();
    }

    /**
     * Claim a batch of pending word-generation tasks.
     * Body: { worker_id: string, language?: string, limit?: int<=50 }
     */
    public function claim(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'worker_id' => 'required|string|max:100',
            'language' => 'nullable|string|max:10',
            'limit' => 'nullable|integer|min:0|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed: ' . $validator->errors()->first(),
            ], 422);
        }

        $limit = (int) $request->input('limit', 20);

        if ($limit <= 0) {
            $stats = $this->coordinator->statistics();
            $byStatus = $stats['by_status'] ?? [];

            return response()->json([
                'success' => true,
                'data' => [
                    'count' => 0,
                    'pending' => (int) ($byStatus['pending'] ?? 0),
                    'leased' => (int) ($byStatus['processing'] ?? 0),
                    'tasks' => [],
                    'lock_stale_minutes' => AppQyV1DictionaryTTSCoordinator::LOCK_STALE_MINUTES,
                ],
            ]);
        }

        $tasks = $this->coordinator->claimWords(
            $request->input('worker_id'),
            $request->input('language'),
            $limit
        );

        return response()->json([
            'success' => true,
            'data' => [
                'count' => count($tasks),
                'tasks' => $tasks,
                'lock_stale_minutes' => AppQyV1DictionaryTTSCoordinator::LOCK_STALE_MINUTES,
            ],
        ]);
    }

    /**
     * Report one generation result.
     *
     * Multipart form:
     *   task_id   (required int — encoded id from claim)
     *   worker_id (required string)
     *   success   (required bool-ish)
     *   audio     (file, required when success) — MP3 payload
     *   provider  (optional string, e.g. 'edge-tts' / 'sherpa-onnx')
     *   error     (optional string, for failure reports)
     *
     * Also accepts JSON with `audio_base64` instead of the multipart file.
     */
    public function report(Request $request): JsonResponse
    {
        $success = false;
        $audioBinary = null;
        $offsetReceipt = null;
        $publicReceipt = [];
        $result = [];
        $httpStatus = 0;

        $validator = Validator::make($request->all(), [
            'task_id' => 'required|integer|min:1',
            'worker_id' => 'required|string|max:100',
            'success' => 'required',
            'provider' => 'nullable|string|max:100',
            'error' => 'nullable|string|max:2000',
            'audio_base64' => 'nullable|string',
            'upload_protocol' => 'nullable|string|in:offset-v1',
            'upload_offset' => 'required_with:upload_protocol|integer|min:0',
            'upload_length' => 'required_with:upload_protocol|integer|min:100',
            'audio_sha256' => ['required_with:upload_protocol', 'nullable', 'string', 'regex:/^[a-f0-9]{64}$/'],
            'chunk_sha256' => ['required_with:upload_protocol', 'nullable', 'string', 'regex:/^[a-f0-9]{64}$/'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed: ' . $validator->errors()->first(),
            ], 422);
        }

        $success = filter_var($request->input('success'), FILTER_VALIDATE_BOOLEAN);

        if ($success) {
            if ($request->filled('upload_protocol')) {
                $offsetReceipt = $this->uploadService->receive(
                    'word_tts',
                    (string) $request->input('task_id'),
                    (string) $request->getContent(),
                    (int) $request->input('upload_offset'),
                    (int) $request->input('upload_length'),
                    (string) $request->input('audio_sha256'),
                    (string) $request->input('chunk_sha256')
                );
                if ($offsetReceipt === null) {
                    return response()->json(['success' => false, 'error' => 'Invalid durable audio chunk'], 422);
                }
                $publicReceipt = $this->uploadService->publicReceipt($offsetReceipt);
                if (!($offsetReceipt['upload_complete'] ?? false)) {
                    return response()->json(['success' => true, 'data' => $publicReceipt]);
                }
                $audioBinary = $this->uploadService->completedBytes($offsetReceipt);
                if ($audioBinary === false) {
                    return response()->json(['success' => false, 'error' => 'Completed audio upload is unreadable'], 500);
                }
            } elseif ($request->hasFile('audio')) {
                $file = $request->file('audio');
                if (!$file->isValid()) {
                    return response()->json(['success' => false, 'error' => 'Audio upload failed'], 422);
                }
                $audioBinary = @file_get_contents($file->getRealPath());
            } elseif ($request->filled('audio_base64')) {
                $audioBinary = base64_decode($request->input('audio_base64'), true);
                if ($audioBinary === false) {
                    return response()->json(['success' => false, 'error' => 'audio_base64 is not valid base64'], 422);
                }
            }

            if ($audioBinary === null) {
                return response()->json([
                    'success' => false,
                    'error' => 'Success reports must include an audio file (multipart "audio") or audio_base64',
                ], 422);
            }
        }

        try {
            $result = $this->coordinator->reportWordResult(
                (int) $request->input('task_id'),
                $request->input('worker_id'),
                $success,
                $audioBinary,
                $request->input('provider'),
                $request->input('error')
            );
        } catch (\Throwable $e) {
            Log::error('[TTSWorker] report failed', [
                'task_id' => $request->input('task_id'),
                'error' => $e->getMessage(),
            ]);
            return response()->json(['success' => false, 'error' => 'Internal error ingesting result'], 500);
        }

        $httpStatus = $result['http_status'] ?? ($result['success'] ? 200 : 500);
        unset($result['http_status']);
        if ($offsetReceipt !== null) {
            return response()->json([
                'success' => (bool) ($result['success'] ?? false),
                'data' => array_merge($publicReceipt, $result),
            ], $httpStatus);
        }

        return response()->json($result, $httpStatus);
    }
}
