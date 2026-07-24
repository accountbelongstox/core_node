<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TranslationEventModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1AssistService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1PosterPriorityService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * Third-party assist protocol (shared worker surface).
 *
 * mcp-chrome claims image work through this lease-based surface. Pycore audio
 * uses the dedicated TTS worker endpoints.
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
    private AppQyV1PosterPriorityService $posterPriority;

    public function __construct()
    {
        $this->assist = new AppQyV1AssistService();
        $this->posterPriority = new AppQyV1PosterPriorityService();
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
     * Body: { types: ('cover'|'poster')[], limit?: int 1..10 = 3, claimer: string }
     * Response: { success, items: [{type, id, payload}], lease_minutes }
     */
    public function claim(Request $request): JsonResponse
    {
        if (!AppQyV1AssistService::isAssistEnabled()) {
            return $this->disabledResponse();
        }

        $validator = Validator::make($request->all(), [
            'types' => 'required|array|min:1',
            'types.*' => 'string|in:cover,poster',
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
            'type' => 'required|string|in:cover,poster',
            'media_type' => 'required_if:type,poster|string|in:book,subtitle',
            'id' => 'required|integer|min:1',
            'image_base64' => 'required_if:type,cover|required_if:type,poster|string',
            'mime' => 'nullable|string|max:100',
            // Provenance (detailed records): which AI provider/model/engine made
            // the artifact and how long it took. All optional + best-effort.
            'provider' => 'nullable|string|max:64',
            'model' => 'nullable|string|max:128',
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
     * Body: { type:'cover'|'poster', ids: int[], error?: string,
     *         claimer?: string, media_type?:'book'|'subtitle' (poster only) }
     * Response: { released: int }
     */
    public function release(Request $request): JsonResponse
    {
        if (!AppQyV1AssistService::isAssistEnabled()) {
            return $this->disabledResponse();
        }

        $validator = Validator::make($request->all(), [
            'type' => 'required|string|in:cover,poster',
            'media_type' => 'required_if:type,poster|string|in:book,subtitle',
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|min:1',
            'error' => 'nullable|string|max:2000',
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

        try {
            if ($type === 'cover') {
                $released = $this->assist->releaseCovers($ids, $error);
            } elseif ($type === 'poster') {
                $released = $this->assist->releasePosters((string) $request->input('media_type'), $ids, $error);
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
     * cover_error_message so mcp-chrome reclaims them.
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
            $model = new AppQyV1VocabularyLibraryModel();
            $connection = DB::connection($model->getConnectionName());
            $boost = $connection->transaction(function () use ($ids, $all): array {
                $head = AppQyV1VocabularyLibraryModel::query()
                    ->orderByDesc('cover_priority')
                    ->lockForUpdate()
                    ->first(['cover_priority']);
                $ticket = (int) ($head->cover_priority ?? 0) + 1;
                $query = AppQyV1VocabularyLibraryModel::query()
                    ->whereIn('cover_status', ['pending', 'retry', 'failed']);
                if (!$all) {
                    $query->whereIn('id', $ids);
                }
                $promoted = $query->update([
                    'cover_priority' => $ticket,
                    'cover_status' => 'pending',
                    'assist_claimed_by' => null,
                    'assist_claimed_at' => null,
                ]);
                return ['priority' => $ticket, 'promoted' => $promoted];
            });
            AppQyV1TranslationEventModel::emit('cover.priority', [
                'batch' => true,
                'count' => $boost['promoted'],
                'ids' => $all ? [] : array_values($ids),
                'all' => $all,
                'priority' => $boost['priority'],
            ]);
        } catch (\Throwable $e) {
            Log::error('[Assist] cover retry failed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => 'Internal error during retry'], 500);
        }

        return response()->json([
            'success' => true,
            'reset' => $reset,
            'promoted' => $boost['promoted'],
            'priority' => $boost['priority'],
        ]);
    }

    public function posterPriority(Request $request): JsonResponse
    {
        if (!AppQyV1AssistService::isAssistEnabled()) {
            return $this->disabledResponse();
        }
        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1|max:100',
            'items.*.media_type' => 'required|string|in:book,subtitle',
            'items.*.id' => 'required|integer|min:1',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'error' => $validator->errors()->first()], 422);
        }

        $items = $request->input('items');
        $promoted = $this->posterPriority->promote($items);
        AppQyV1TranslationEventModel::emit('poster.priority', [
            'batch' => true,
            'count' => $promoted,
            'items' => $items,
        ]);
        return response()->json(['success' => true, 'promoted' => $promoted]);
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
     * them to 'pending' so mcp-chrome replaces them (recovery for lost files).
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

    /**
     * GET /api/app_qy_v1/assist/overview
     *
     * Single rich aggregate snapshot consumed by pycore's Queue Center overview
     * (SHARED CONTRACT v2). Returns every assist category (word_translation,
     * word_media, word_audio, sentence_audio, subtitle_lang, book_lang, cover,
     * poster) with pending/processing/leased/total + by_language + sample rows,
     * plus the online worker roster. Cache-backed (30s TTL); ?fresh=1 forces a
     * recompute. NO-AUTH, matching the other assist worker surfaces.
     */
    public function overview(Request $request): JsonResponse
    {
        $fresh = (bool) $request->query('fresh', false);

        try {
            $snapshot = $this->assist->overviewSnapshot($fresh);
        } catch (\Throwable $e) {
            Log::error('[Assist] overview failed', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'error' => 'Internal error building overview',
                'categories' => [],
                'workers' => [],
            ], 500);
        }

        return response()->json($snapshot);
    }

    /**
     * GET /api/app_qy_v1/assist/overview/items
     *
     * Paginated drill-down for one assist/overview category (word_audio,
     * sentence_audio, cover, poster, …). NO-AUTH, same trust level as /overview.
     */
    public function overviewItems(Request $request): JsonResponse
    {
        $validated = Validator::make($request->all(), [
            'category' => 'required|string|in:' . implode(',', AppQyV1AssistService::OVERVIEW_CATEGORY_KEYS),
            'status' => 'nullable|string|in:pending,processing,completed,failed,leased',
            'start' => 'nullable|integer|min:0',
            'limit' => 'nullable|integer|min:1|max:500',
        ]);

        if ($validated->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed: ' . $validated->errors()->first(),
            ], 422);
        }

        $data = $request->all();
        $start = isset($data['start']) ? (int) $data['start'] : 0;
        $limit = isset($data['limit']) ? (int) $data['limit'] : 50;
        $status = isset($data['status']) ? (string) $data['status'] : null;

        try {
            $result = $this->assist->categoryItems((string) $data['category'], $status, $start, $limit);
        } catch (\Throwable $e) {
            Log::error('[Assist] overview/items failed', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'error' => 'Internal error listing category items',
            ], 500);
        }

        return response()->json(array_merge(['success' => true], $result));
    }
}
