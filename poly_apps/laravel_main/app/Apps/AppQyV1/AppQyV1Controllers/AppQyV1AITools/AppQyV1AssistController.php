<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1AssistService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

/**
 * Third-party assist protocol (pycore worker surface).
 *
 * pycore claims units of work (vocabulary covers, TTS words), generates them
 * with its local providers and reports the artifacts back. Claims carry a
 * 60-minute lease; see AppQyV1AssistService for the exact semantics.
 *
 * Routes (routes/AppQyV1Router/AppQyV1Assist.php):
 *   POST /api/app_qy_v1/assist/claim
 *   POST /api/app_qy_v1/assist/submit
 *   POST /api/app_qy_v1/assist/release
 *   POST /api/app_qy_v1/assist/cover/retry
 *   GET  /api/app_qy_v1/assist/status
 *
 * Gating: the claim/submit/release/retry endpoints are gated behind env
 * APPQYV1_ASSIST_ENABLED (default true). When disabled they return
 * { success:false, error:'assist disabled' } with HTTP 200 (not a hard 404)
 * so the worker logs cleanly and backs off; GET /status stays reachable and
 * reports enabled=false + mode='pull'.
 *
 * Trust level: NO-AUTH, identical to the existing pycore worker surfaces
 * (/api/app_qy_v1/ai_tools/tts/worker/*, /api/worker/tasks/*,
 * /ai_tools/translation/queue/{list,priority,stack}): pycore is a
 * server-side caller without a user token, and every submitted artifact is
 * validated (magic bytes + on-disk verification) before it can touch state.
 */
class AppQyV1AssistController extends Controller
{
    private AppQyV1AssistService $assist;

    public function __construct()
    {
        $this->assist = new AppQyV1AssistService();
    }

    /**
     * Disabled-assist response (HTTP 200) when APPQYV1_ASSIST_ENABLED is false.
     * Returned by the write endpoints so the worker backs off without errors.
     */
    private function disabledResponse(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'error' => 'assist disabled',
        ], 200);
    }

    /**
     * POST /api/app_qy_v1/assist/claim
     * Body: { types: ('cover'|'tts')[], limit?: int 1..10 = 3, claimer: string }
     * Response: { success, items: [{type, id, payload}], lease_minutes }
     */
    public function claim(Request $request): JsonResponse
    {
        if (!AppQyV1AssistService::isAssistEnabled()) {
            return $this->disabledResponse();
        }

        $validator = Validator::make($request->all(), [
            'types' => 'required|array|min:1',
            'types.*' => 'string|in:cover,tts,poster',
            'limit' => 'nullable|integer|min:1|max:10',
            'claimer' => 'required|string|min:1|max:56',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed: ' . $validator->errors()->first(),
            ], 422);
        }

        $types = array_values(array_unique($request->input('types')));
        $limit = (int) $request->input('limit', 3);
        $claimer = trim($request->input('claimer'));

        $items = [];
        try {
            // Per-type limit (the claim selects up to $limit rows per type).
            if (in_array('cover', $types, true)) {
                $items = array_merge($items, $this->assist->claimCovers($claimer, $limit));
            }
            if (in_array('tts', $types, true)) {
                $items = array_merge($items, $this->assist->claimTts($claimer, $limit));
            }
            if (in_array('poster', $types, true)) {
                $items = array_merge($items, $this->assist->claimPosters($claimer, $limit));
            }
        } catch (\Throwable $e) {
            Log::error('[Assist] claim failed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => 'Internal error during claim'], 500);
        }

        return response()->json([
            'success' => true,
            'items' => $items,
            'lease_minutes' => AppQyV1AssistService::LEASE_MINUTES,
        ]);
    }

    /**
     * POST /api/app_qy_v1/assist/submit
     * Body (cover):  { type:'cover', id, image_base64, mime?, claimer? }
     * Body (tts):    { type:'tts', id, audio_base64, mime?, voice?, claimer? }
     * Body (poster): { type:'poster', media_type:'book'|'subtitle', id,
     *                  image_base64, mime?, claimer?, provider?, source_id? }
     * Response: { ok, status, already_done?, error? }
     */
    public function submit(Request $request): JsonResponse
    {
        if (!AppQyV1AssistService::isAssistEnabled()) {
            return $this->disabledResponse();
        }

        $validator = Validator::make($request->all(), [
            'type' => 'required|string|in:cover,tts,poster',
            'media_type' => 'required_if:type,poster|string|in:book,subtitle',
            'id' => 'required|integer|min:1',
            'image_base64' => 'required_if:type,cover|required_if:type,poster|string',
            'audio_base64' => 'required_if:type,tts|string',
            'mime' => 'nullable|string|max:100',
            'voice' => 'nullable|string|max:100',
            'claimer' => 'nullable|string|max:56',
            // Provenance (detailed records): which AI provider/model/engine made
            // the artifact and how long it took. All optional + best-effort.
            'provider' => 'nullable|string|max:64',
            'model' => 'nullable|string|max:128',
            'engine' => 'nullable|string|max:64',
            'latency_ms' => 'nullable|integer|min:0',
            // Poster provenance: the movie-DB / generator result id.
            'source_id' => 'nullable|string|max:64',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'ok' => false,
                'status' => 'invalid',
                'error' => 'Validation failed: ' . $validator->errors()->first(),
            ], 422);
        }

        $type = $request->input('type');
        $id = (int) $request->input('id');
        $claimer = trim((string) $request->input('claimer', '')) ?: 'unknown';

        try {
            $latencyMs = $request->input('latency_ms');
            if ($latencyMs !== null) {
                $latencyMs = (int) $latencyMs;
            }
            if ($type === 'cover') {
                $result = $this->assist->submitCover(
                    $id,
                    (string) $request->input('image_base64'),
                    $request->input('mime'),
                    $request->input('provider'),
                    $request->input('model'),
                    $latencyMs
                );
            } elseif ($type === 'poster') {
                $result = $this->assist->submitPoster(
                    (string) $request->input('media_type'),
                    $id,
                    (string) $request->input('image_base64'),
                    $request->input('mime'),
                    $request->input('provider'),
                    $request->input('source_id')
                );
            } else {
                $result = $this->assist->submitTts(
                    $id,
                    (string) $request->input('audio_base64'),
                    $claimer,
                    $request->input('voice'),
                    $request->input('engine') ?? $request->input('provider')
                );
            }
        } catch (\Throwable $e) {
            Log::error('[Assist] submit failed', ['type' => $type, 'id' => $id, 'error' => $e->getMessage()]);
            return response()->json(['ok' => false, 'status' => 'error', 'error' => 'Internal error ingesting result'], 500);
        }

        $httpStatus = $result['http_status'];
        unset($result['http_status']);
        if (($result['error'] ?? null) === null) {
            unset($result['error']);
        }

        return response()->json($result, $httpStatus);
    }

    /**
     * POST /api/app_qy_v1/assist/release
     * Body: { type:'cover'|'tts'|'poster', ids: int[], error?: string,
     *         claimer?: string, media_type?:'book'|'subtitle' (poster only) }
     * Response: { released: int }
     */
    public function release(Request $request): JsonResponse
    {
        if (!AppQyV1AssistService::isAssistEnabled()) {
            return $this->disabledResponse();
        }

        $validator = Validator::make($request->all(), [
            'type' => 'required|string|in:cover,tts,poster',
            'media_type' => 'required_if:type,poster|string|in:book,subtitle',
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|min:1',
            'error' => 'nullable|string|max:2000',
            'claimer' => 'nullable|string|max:56',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed: ' . $validator->errors()->first(),
            ], 422);
        }

        $type = $request->input('type');
        $ids = $request->input('ids');
        $error = $request->input('error');
        $claimer = trim((string) $request->input('claimer', '')) ?: 'unknown';

        try {
            if ($type === 'cover') {
                $released = $this->assist->releaseCovers($ids, $error);
            } elseif ($type === 'poster') {
                $released = $this->assist->releasePosters((string) $request->input('media_type'), $ids, $error);
            } else {
                $released = $this->assist->releaseTts($ids, $error, $claimer);
            }
        } catch (\Throwable $e) {
            Log::error('[Assist] release failed', ['type' => $type, 'error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => 'Internal error during release'], 500);
        }

        return response()->json([
            'success' => true,
            'released' => $released,
        ]);
    }

    /**
     * POST /api/app_qy_v1/assist/cover/retry
     * Body: { ids?: int[], all?: bool }
     * Response: { success, reset: int }
     *
     * Resets the given failed/stuck covers (or ALL failed/stuck rows when
     * all=true) back to pending, cover_attempts = 0, clearing the lease +
     * cover_error_message so pycore re-claims them.
     */
    public function coverRetry(Request $request): JsonResponse
    {
        if (!AppQyV1AssistService::isAssistEnabled()) {
            return $this->disabledResponse();
        }

        $validator = Validator::make($request->all(), [
            'ids' => 'nullable|array',
            'ids.*' => 'integer|min:1',
            'all' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed: ' . $validator->errors()->first(),
            ], 422);
        }

        $ids = (array) $request->input('ids', []);
        $all = (bool) $request->boolean('all');

        if (!$all && empty($ids)) {
            return response()->json([
                'success' => false,
                'error' => 'Provide ids[] or all=true',
            ], 422);
        }

        try {
            $reset = $this->assist->retryFailedCovers($ids, $all);
        } catch (\Throwable $e) {
            Log::error('[Assist] cover retry failed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => 'Internal error during retry'], 500);
        }

        return response()->json([
            'success' => true,
            'reset' => $reset,
        ]);
    }

    /**
     * POST /api/app_qy_v1/assist/cover/clear
     * Body: { ids?: int[], all?: bool, failed_only?: bool }
     * Response: { success, cleared:int, files_deleted:int }
     *
     * Deletes the cover image file(s) and re-queues the row(s) to 'pending' with
     * a fresh randomized prompt, so pycore regenerates them. Use to discard
     * unsatisfactory covers. failed_only=true narrows to failed/retry rows.
     */
    public function coverClear(Request $request): JsonResponse
    {
        if (!AppQyV1AssistService::isAssistEnabled()) {
            return $this->disabledResponse();
        }

        $validator = Validator::make($request->all(), [
            'ids' => 'nullable|array',
            'ids.*' => 'integer|min:1',
            'all' => 'nullable|boolean',
            'failed_only' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed: ' . $validator->errors()->first(),
            ], 422);
        }

        $ids = (array) $request->input('ids', []);
        $all = (bool) $request->boolean('all');
        $failedOnly = (bool) $request->boolean('failed_only');

        if (!$all && empty($ids)) {
            return response()->json([
                'success' => false,
                'error' => 'Provide ids[] or all=true',
            ], 422);
        }

        try {
            $result = $this->assist->clearCovers($ids, $all, $failedOnly);
        } catch (\Throwable $e) {
            Log::error('[Assist] cover clear failed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => 'Internal error during clear'], 500);
        }

        return response()->json(['success' => true] + $result);
    }

    /**
     * POST /api/app_qy_v1/assist/cover/reconcile
     * Response: { success, reset:int, checked:int }
     *
     * Finds covers marked 'ready' whose file is missing on disk and re-queues
     * them to 'pending' so pycore regenerates them (recovery for lost files).
     */
    public function coverReconcile(): JsonResponse
    {
        if (!AppQyV1AssistService::isAssistEnabled()) {
            return $this->disabledResponse();
        }

        try {
            $result = $this->assist->reconcileMissingCovers();
        } catch (\Throwable $e) {
            Log::error('[Assist] cover reconcile failed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => 'Internal error during reconcile'], 500);
        }

        return response()->json(['success' => true] + $result);
    }

    /**
     * GET /api/app_qy_v1/assist/status
     * Response: { success, enabled, mode:'pull',
     *             cover: {pending,retry,processing,ready,failed,total,leased},
     *             tts: {pending,processing,completed,failed,leased},
     *             poster: {pending,ready,failed,none,total,leased},
     *             lease_minutes: 60 }
     */
    public function status(): JsonResponse
    {
        // Serve the cover/tts/translation counts from the warm, cached pending
        // snapshot (same three count methods, kept fresh by the Octane cover
        // timer). This poll-heavy endpoint — hit by the dashboard strip AND the
        // pycore assist passthrough every ~15s — no longer recomputes ~40
        // aggregate COUNT queries on every call.
        $snapshot = $this->assist->pendingSnapshot(false);

        return response()->json([
            'success' => true,
            'enabled' => $snapshot['enabled'] ?? AppQyV1AssistService::isAssistEnabled(),
            'mode' => 'pull',
            'cover' => $snapshot['cover'],
            'tts' => $snapshot['tts'],
            'translation' => $snapshot['translation'],
            'poster' => $snapshot['poster'] ?? null,
            'lease_minutes' => $snapshot['lease_minutes'] ?? AppQyV1AssistService::LEASE_MINUTES,
        ]);
    }

    /**
     * GET /api/app_qy_v1/assist/pending
     *
     * Cheap, cache-backed pending-work snapshot across all three assist tracks
     * (cover / tts / translation). The Octane cover timer warms the cache every
     * tick, so this read almost never hits the database — third-party workers
     * and the dashboard poll it freely. ?fresh=1 forces a recompute.
     */
    public function pending(Request $request): JsonResponse
    {
        $fresh = (bool) $request->query('fresh', false);

        return response()->json([
            'success' => true,
            'snapshot' => $this->assist->pendingSnapshot($fresh),
        ]);
    }
}
