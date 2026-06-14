<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AiGateway\AiChat;
use App\Services\AiGateway\AiGateway;
use App\Services\AiGateway\AiImageHistory;
use App\Services\AiGateway\AiProbe;
use App\Services\AiGateway\AiRateLimiter;
use App\Services\AiGateway\AiUsageLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Local AI surface for laravel_main — the PHP twin of pycore's
 * /api/local/ai/* routers (ai_probe_router / ai_chat_router / ai_image_router).
 *
 * Same paths, same response contracts, so the dashboard's AI Management page can
 * talk to either runtime. Keys and free-tier RATE counters are SHARED with
 * pycore (same secret files + same <core_node>/.ai_state/ai_rate_usage.json), so
 * usage from both ends counts against one budget.
 *
 *   GET  /api/local/ai/catalog        list providers, no network test
 *   GET  /api/local/ai/probe          ?provider=NAME (one) | else test all (~30s cache, ?refresh=1)
 *   POST /api/local/ai/chat           { provider?, message?|messages?, model?, source? }
 *   GET  /api/local/ai/gateway        per-provider tier/usage/cooldown + records (?refresh=1 for live quota)
 *   GET  /api/local/ai/rate-limits    ?provider=NAME | else all enforced providers
 *   POST /api/local/ai/image          { prompt, size?, model?, source? }
 *   GET  /api/local/ai/info           endpoint catalog (for the API tester)
 */
class AiLocalController extends Controller
{
    /** Probe-all cache (mirrors pycore's ~30s TTL on the probe router). */
    private const PROBE_CACHE_TTL_S = 30.0;
    private static ?array $probeCache = null;
    private static float $probeCacheTs = 0.0;

    /** Bound prompt length on the image endpoint (matches pycore). */
    private const IMAGE_PROMPT_MAX = 2000;

    public function catalog(): JsonResponse
    {
        return response()->json(AiProbe::catalog());
    }

    public function probe(Request $request): JsonResponse
    {
        $provider = trim((string) $request->query('provider', ''));
        if ($provider !== '') {
            // Single-provider test: always live, never cached.
            return response()->json(AiProbe::probeOne($provider));
        }

        $refresh = (bool) $request->query('refresh', false);
        $now = microtime(true);
        if (!$refresh && self::$probeCache !== null && ($now - self::$probeCacheTs) < self::PROBE_CACHE_TTL_S) {
            $out = self::$probeCache;
            $out['cached'] = true;
            $out['age_ms'] = round(($now - self::$probeCacheTs) * 1000, 1);
            return response()->json($out);
        }

        $result = AiProbe::probeAll();
        self::$probeCache = $result;
        self::$probeCacheTs = microtime(true);

        $out = $result;
        $out['cached'] = false;
        $out['age_ms'] = 0.0;
        return response()->json($out);
    }

    public function chat(Request $request): JsonResponse
    {
        $messages = [];
        foreach ((array) $request->input('messages', []) as $m) {
            if (is_array($m) && isset($m['content'])) {
                $messages[] = ['role' => (string) ($m['role'] ?? 'user'), 'content' => (string) $m['content']];
            }
        }
        $message = trim((string) $request->input('message', ''));
        if (empty($messages) && $message !== '') {
            $messages = [['role' => 'user', 'content' => $message]];
        }

        $provider = strtolower(trim((string) $request->input('provider', '')));
        $model = $request->input('model');
        $model = $model !== null ? (string) $model : null;
        $source = (string) $request->input('source', 'chat');

        if ($provider === '' || $provider === 'auto') {
            return response()->json(AiGateway::generateText(null, $messages, $model, null, $source ?: 'chat'));
        }
        return response()->json(AiChat::chatOnce($provider, $messages, $model, $source ?: 'chat'));
    }

    public function gateway(Request $request): JsonResponse
    {
        $refresh = (bool) $request->query('refresh', false);
        return response()->json(AiGateway::gatewayStatus($refresh));
    }

    public function rateLimits(Request $request): JsonResponse
    {
        $provider = trim((string) $request->query('provider', ''));
        return response()->json(AiRateLimiter::rateStatus($provider !== '' ? $provider : null));
    }

    /**
     * GET /api/local/ai/usage?limit=100&kind= — shared cross-runtime AI usage
     * log (text / vision / probe records, newest first) + per-provider/kind
     * rollup. Same store pycore writes; image generations live in image/history.
     */
    public function usage(Request $request): JsonResponse
    {
        $limit = (int) $request->query('limit', 100);
        if ($limit <= 0) {
            $limit = 100;
        }
        $kind = trim((string) $request->query('kind', ''));
        return response()->json(AiUsageLog::log($limit, $kind !== '' ? $kind : null));
    }

    public function image(Request $request): JsonResponse
    {
        $prompt = trim((string) $request->input('prompt', ''));
        if ($prompt === '') {
            return response()->json(['success' => false, 'error' => 'prompt is required'], 400);
        }
        if (mb_strlen($prompt) > self::IMAGE_PROMPT_MAX) {
            return response()->json(['success' => false, 'error' => 'prompt too long (max ' . self::IMAGE_PROMPT_MAX . ' chars)'], 400);
        }
        $size = $request->input('size');
        $model = $request->input('model');
        $source = (string) $request->input('source', 'image');
        $sizeStr = $size !== null ? (string) $size : null;

        $result = AiGateway::generateImage(
            $prompt,
            $sizeStr,
            $model !== null ? (string) $model : null,
            $source ?: 'image'
        );

        // Record the generated image to the shared cross-runtime history
        // (best-effort: a history failure must never break the image response).
        if (!empty($result['success']) && !empty($result['image_base64'])) {
            try {
                AiImageHistory::record([
                    'provider' => (string) ($result['provider'] ?? ''),
                    'model' => (string) ($result['model'] ?? ''),
                    'prompt' => $prompt,
                    'size' => $sizeStr ?? '',
                    'mime' => (string) ($result['mime'] ?? 'image/png'),
                    'latency_ms' => $result['latency_ms'] ?? null,
                    'source' => $source ?: 'image',
                    'origin' => 'laravel',
                    'ok' => true,
                ], (string) $result['image_base64']);
            } catch (\Throwable $e) {
                // Swallow — image delivery never depends on history succeeding.
            }
        }

        return response()->json($result);
    }

    /**
     * GET /api/local/ai/image/history?limit=50 — newest-first metadata (no bytes).
     * Shared with pycore: shows images both runtimes generated.
     */
    public function imageHistory(Request $request): JsonResponse
    {
        $limit = (int) $request->query('limit', 50);
        if ($limit <= 0) {
            $limit = 50;
        }
        return response()->json([
            'success' => true,
            'entries' => AiImageHistory::list($limit),
        ]);
    }

    /**
     * GET /api/local/ai/image/history/file/{id} — raw image bytes (Content-Type
     * = stored mime), 404 when the id / file is missing.
     */
    public function imageHistoryFile(string $id): Response
    {
        $img = AiImageHistory::read($id);
        if ($img === null) {
            return response()->json(['success' => false, 'error' => 'not found'], 404);
        }
        return response($img['bytes'], 200, [
            'Content-Type' => $img['mime'],
            'Content-Length' => (string) strlen($img['bytes']),
            'Cache-Control' => 'private, max-age=86400',
        ]);
    }

    /** DELETE /api/local/ai/image/history/{id} — remove one entry + its file. */
    public function imageHistoryDelete(string $id): JsonResponse
    {
        return response()->json(['success' => AiImageHistory::delete($id)]);
    }

    /** POST /api/local/ai/image/history/clear — remove ALL entries + files. */
    public function imageHistoryClear(): JsonResponse
    {
        return response()->json(['success' => true, 'removed' => AiImageHistory::clear()]);
    }

    public function info(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'name' => 'Local AI Gateway',
            'description' => 'Unified multi-provider AI gateway for laravel_main (keys + rate shared with pycore).',
            'shared_rate_store' => AiRateLimiter::usageFile(),
            'endpoints' => [
                'GET  /api/local/ai/catalog' => 'List all providers (no network test).',
                'GET  /api/local/ai/probe?provider=NAME' => 'Live test one provider.',
                'GET  /api/local/ai/probe?refresh=1' => 'Live test all providers.',
                'POST /api/local/ai/chat' => '{ provider?, message?|messages?, model?, source? } — auto = smart dispatch.',
                'GET  /api/local/ai/gateway?refresh=1' => 'Per-provider tier/usage/cooldown + recent records.',
                'GET  /api/local/ai/rate-limits?provider=NAME' => 'Local usage vs free-tier limits (shared with pycore).',
                'POST /api/local/ai/image' => '{ prompt, size?, model?, source? } — image-capable providers (records shared history).',
                'GET  /api/local/ai/image/history?limit=50' => 'Newest-first image history metadata (shared with pycore).',
                'GET  /api/local/ai/image/history/file/{id}' => 'Raw bytes of one history image.',
                'DELETE /api/local/ai/image/history/{id}' => 'Remove one history image.',
                'POST /api/local/ai/image/history/clear' => 'Remove all history images.',
            ],
        ]);
    }
}
