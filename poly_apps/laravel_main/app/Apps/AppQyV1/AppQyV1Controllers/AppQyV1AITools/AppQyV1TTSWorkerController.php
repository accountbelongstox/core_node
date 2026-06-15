<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryTTSCoordinator;
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

    public function __construct()
    {
        $this->coordinator = new AppQyV1DictionaryTTSCoordinator();
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
            'limit' => 'nullable|integer|min:1|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed: ' . $validator->errors()->first(),
            ], 422);
        }

        $tasks = $this->coordinator->claimWords(
            $request->input('worker_id'),
            $request->input('language'),
            (int) $request->input('limit', 20)
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
        $validator = Validator::make($request->all(), [
            'task_id' => 'required|integer|min:1',
            'worker_id' => 'required|string|max:100',
            'success' => 'required',
            'provider' => 'nullable|string|max:100',
            'error' => 'nullable|string|max:2000',
            'audio_base64' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed: ' . $validator->errors()->first(),
            ], 422);
        }

        $success = filter_var($request->input('success'), FILTER_VALIDATE_BOOLEAN);

        $audioBinary = null;
        if ($success) {
            if ($request->hasFile('audio')) {
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

        return response()->json($result, $httpStatus);
    }
}
