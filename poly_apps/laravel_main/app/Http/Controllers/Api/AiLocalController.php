<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AiGateway\AiChat;
use App\Services\AiGateway\AiGateway;
use App\Services\AiGateway\AiImageHistory;
use App\Services\AiGateway\AiKeyRotation;
use App\Services\AiGateway\AiProbe;
use App\Services\AiGateway\AiProviderRegistry;
use App\Services\AiGateway\AiPromptCache;
use App\Services\AiGateway\AiRateLimiter;
use App\Services\AiGateway\AiSdkChat;
use App\Utils\SecretStore;
use App\Services\AiGateway\AiSecretWriter;
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
 *
 * Official Laravel AI SDK surface (laravel/ai — capabilities, persistent chat,
 * gateway prompt cache):
 *   GET  /api/local/ai/capabilities              provider × feature matrix (no key needed)
 *   GET  /api/local/ai/chat/conversations        newest-first chat sessions
 *   GET  /api/local/ai/chat/conversations/{id}   full message list of one session
 *   DELETE /api/local/ai/chat/conversations/{id} delete one session
 *   POST /api/local/ai/chat/send                 { conversation_id?, provider?, model?, message, images?, cache? }
 *   GET  /api/local/ai/chat/attachments/{name}   raw bytes of one chat image
 *   GET  /api/local/ai/prompt-cache              totals / per-provider stats / recent entries
 *   POST /api/local/ai/prompt-cache/clear        drop every cached prompt response
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

    /**
     * GET /api/local/ai/keys — per-provider AI key inventory. For every provider
     * it returns the relevant secret slots (indexed _1.._5, bare, dedicated image
     * _IMAGE_1..5, and the extra-secret name if any), each as
     * { name, set, masked }. Values are NEVER returned — only the first4…last4
     * mask (or null when unset). Keys are SHARED with pycore.
     */
    public function keysList(): JsonResponse
    {
        $out = [];
        foreach (AiProviderRegistry::orderedNames() as $provider) {
            $keyBase = AiProviderRegistry::keyBase($provider);
            $extraName = AiProviderRegistry::extraSecretName($provider);
            $keyless = AiProviderRegistry::isKeyless($provider);

            $slotNames = [];
            if ($keyBase !== '') {
                for ($i = 1; $i <= 5; $i++) {
                    $slotNames[] = $keyBase . '_' . $i;
                }
                $slotNames[] = $keyBase;
                for ($i = 1; $i <= 5; $i++) {
                    $slotNames[] = $keyBase . '_IMAGE_' . $i;
                }
            }
            if ($extraName !== '') {
                $slotNames[] = $extraName;
            }
            // base-url override + aux config (endpoint / deployment / region /
            // spark triple) so card-bound providers are fully UI-configurable.
            $baseUrlName = AiProviderRegistry::baseUrlKeyName($provider);
            if ($baseUrlName !== '') {
                $slotNames[] = $baseUrlName;
            }
            foreach (AiProviderRegistry::auxSecretNames($provider) as $aux) {
                $slotNames[] = $aux;
            }

            $slots = [];
            foreach (array_values(array_unique($slotNames)) as $name) {
                $raw = SecretStore::get($name);
                $set = $raw !== '';
                $isSecret = AiProviderRegistry::isSecretName($name);
                $slots[] = [
                    'name' => $name,
                    'set' => $set,
                    // True secret → mask; plain config (endpoint/deployment/region/
                    // base-url) is safe to show in full so the user can verify it.
                    'secret' => $isSecret,
                    'masked' => $set ? ($isSecret ? SecretStore::maskForDisplay($raw) : $raw) : null,
                ];
            }

            // Per-key rotation status (cooldown + counters + rate) — same shape as
            // pycore's gateway/keys exposure, so the dashboard shows KEY1/KEY2…
            // health identically on both ends.
            $textKeys = $keyless ? [''] : AiProviderRegistry::allSecrets($provider);
            $imgKeys = $keyless ? [''] : AiProviderRegistry::allImageSecrets($provider);
            $isImage = AiProviderRegistry::imageModel($provider) !== '';

            $out[] = [
                'provider' => $provider,
                'key_base' => $keyBase,
                'extra_secret_name' => $extraName !== '' ? $extraName : null,
                'keyless' => $keyless,
                'image_only' => AiProviderRegistry::isImageOnly($provider),
                'configured' => AiProviderRegistry::isConfigured($provider),
                'image_ready' => AiProviderRegistry::hasImageKey($provider),
                'key_count' => count($textKeys),
                'keys' => AiKeyRotation::status($provider, $textKeys ?: ['']),
                'image_keys' => $isImage ? AiKeyRotation::status($provider . '#image', $imgKeys ?: ['']) : [],
                'slots' => $slots,
            ];
        }

        return response()->json(['success' => true, 'providers' => $out]);
    }

    /**
     * POST /api/local/ai/keys { key_name, value } — write/replace a secret. The
     * name must pass AiSecretWriter::isAllowedKeyName (a known registry base with
     * an allowed suffix), and value must be non-empty. Returns the MASKED form
     * only — never the raw value. 400 on invalid name / empty value.
     */
    public function keySet(Request $request): JsonResponse
    {
        $keyName = strtoupper(trim((string) $request->input('key_name', '')));
        $value = trim((string) $request->input('value', ''));

        if ($keyName === '' || !AiSecretWriter::isAllowedKeyName($keyName)) {
            return response()->json(['success' => false, 'error' => 'invalid key_name'], 400);
        }
        if ($value === '') {
            return response()->json(['success' => false, 'error' => 'value is required'], 400);
        }

        $ok = AiSecretWriter::set($keyName, $value);
        if (!$ok) {
            return response()->json(['success' => false, 'error' => 'failed to write key'], 500);
        }

        // A new/changed key must be reflected by probe/catalog/quota immediately.
        self::invalidateAfterKeyChange();

        $isSecret = AiProviderRegistry::isSecretName($keyName);
        return response()->json([
            'success' => true,
            'key_name' => $keyName,
            'secret' => $isSecret,
            'masked' => $isSecret ? SecretStore::maskForDisplay($value) : $value,
        ]);
    }

    /**
     * POST /api/local/ai/keys/delete { key_name } — remove a secret file. Name
     * must pass the allow-list. Returns { success }.
     */
    public function keyDelete(Request $request): JsonResponse
    {
        $keyName = strtoupper(trim((string) $request->input('key_name', '')));

        if ($keyName === '' || !AiSecretWriter::isAllowedKeyName($keyName)) {
            return response()->json(['success' => false, 'error' => 'invalid key_name'], 400);
        }

        $ok = AiSecretWriter::delete($keyName);
        self::invalidateAfterKeyChange();
        return response()->json(['success' => $ok]);
    }

    /**
     * Drop cached provider state after a key set/delete so the next probe /
     * catalog / gateway reflects the change instead of a stale snapshot.
     */
    private static function invalidateAfterKeyChange(): void
    {
        self::$probeCache = null;
        self::$probeCacheTs = 0.0;
        AiGateway::invalidateCaches();
    }

    // --- Official Laravel AI SDK surface ---------------------------------- //

    /**
     * GET /api/local/ai/capabilities — Laravel AI SDK capability matrix: every
     * configured provider (driver, key state, default models, features) plus
     * the official feature → driver support table. Listed whether or not a key
     * is configured, so the UI can show what Laravel can do out of the box.
     */
    public function capabilities(): JsonResponse
    {
        return response()->json(AiSdkChat::capabilities());
    }

    /** GET /api/local/ai/chat/conversations?limit=50 — newest-first chat sessions. */
    public function chatConversations(Request $request): JsonResponse
    {
        $limit = (int) $request->query('limit', 50);
        return response()->json(AiSdkChat::conversations($limit > 0 ? $limit : 50));
    }

    /** GET /api/local/ai/chat/conversations/{id} — full message list of one session. */
    public function chatMessages(string $id): JsonResponse
    {
        return response()->json(AiSdkChat::messages($id));
    }

    /** DELETE /api/local/ai/chat/conversations/{id} — session + messages + attachments. */
    public function chatConversationDelete(string $id): JsonResponse
    {
        return response()->json(AiSdkChat::deleteConversation($id));
    }

    /**
     * POST /api/local/ai/chat/send — one SDK chat turn:
     *   { conversation_id?, provider? ('auto' = SDK failover), model?,
     *     message, images?: [{ name?, mime, data(base64) }], cache?, source? }
     * Conversations persist server-side (agent_conversations tables); images
     * are stored as local attachments and sent as vision input. With cache on,
     * a repeated prompt is answered from the gateway prompt cache.
     */
    public function chatSend(Request $request): JsonResponse
    {
        return response()->json(AiSdkChat::send([
            'conversation_id' => $request->input('conversation_id'),
            'provider' => $request->input('provider', 'auto'),
            'model' => $request->input('model'),
            'message' => (string) $request->input('message', ''),
            'images' => (array) $request->input('images', []),
            'cache' => $request->input('cache', true),
            'source' => (string) $request->input('source', 'ai-chat'),
        ]));
    }

    /** GET /api/local/ai/chat/attachments/{name} — raw bytes of one chat image. */
    public function chatAttachment(string $name): Response
    {
        $img = AiSdkChat::attachment($name);
        if ($img === null) {
            return response()->json(['success' => false, 'error' => 'not found'], 404);
        }
        return response($img[0], 200, [
            'Content-Type' => $img[1],
            'Content-Length' => (string) strlen($img[0]),
            'Cache-Control' => 'private, max-age=86400',
        ]);
    }

    /** GET /api/local/ai/prompt-cache — hit/miss totals, per-provider stats, recent entries. */
    public function promptCache(): JsonResponse
    {
        return response()->json(AiPromptCache::stats());
    }

    /** POST /api/local/ai/prompt-cache/clear — drop every cached prompt response. */
    public function promptCacheClear(): JsonResponse
    {
        return response()->json(AiPromptCache::clear());
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
                'GET  /api/local/ai/keys' => 'Per-provider key inventory (slots, masked only — never raw).',
                'POST /api/local/ai/keys' => '{ key_name, value } — set/replace an AI provider key (returns masked).',
                'POST /api/local/ai/keys/delete' => '{ key_name } — delete an AI provider key file.',
                'POST /api/local/ai/image' => '{ prompt, size?, model?, source? } — image-capable providers (records shared history).',
                'GET  /api/local/ai/image/history?limit=50' => 'Newest-first image history metadata (shared with pycore).',
                'GET  /api/local/ai/image/history/file/{id}' => 'Raw bytes of one history image.',
                'DELETE /api/local/ai/image/history/{id}' => 'Remove one history image.',
                'POST /api/local/ai/image/history/clear' => 'Remove all history images.',
                'GET  /api/local/ai/capabilities' => 'Laravel AI SDK capability matrix (providers × features, key state).',
                'GET  /api/local/ai/chat/conversations' => 'Newest-first SDK chat sessions.',
                'GET  /api/local/ai/chat/conversations/{id}' => 'Full message list of one session.',
                'DELETE /api/local/ai/chat/conversations/{id}' => 'Delete one session (+ messages + attachments).',
                'POST /api/local/ai/chat/send' => '{ conversation_id?, provider?, model?, message, images?, cache? } — SDK chat turn (vision + failover + prompt cache).',
                'GET  /api/local/ai/chat/attachments/{name}' => 'Raw bytes of one chat attachment image.',
                'GET  /api/local/ai/prompt-cache' => 'Prompt-cache totals, per-provider stats and recent entries.',
                'POST /api/local/ai/prompt-cache/clear' => 'Drop every cached prompt response.',
            ],
        ]);
    }
}
