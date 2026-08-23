<?php

namespace App\Services\AiGateway;

use App\Providers\PathMapper;
use App\Utils\SecretStore;
use Illuminate\Support\Facades\Http;

/**
 * Unified AI gateway — the PHP port of pycore's pyctl.ai.ai_gateway.
 *
 * The single AI exit for laravel_main:
 *   generateText(prompt|messages, ...)  -> unified text contract
 *   generateImage(prompt, ...)          -> unified image contract
 *   gatewayStatus()                     -> per-provider tier/usage/cooldown + records
 *
 * Smart dispatch (per call): tier order free -> balance -> paid within
 * PROVIDER_ORDER; a preferred provider is pinned first; cooled-down providers
 * are skipped. A rate-limit/quota failure (429 / resource_exhausted /
 * insufficient / overloaded / 402) puts the provider on an exponential cooldown
 * (60s -> 120s -> ... capped at 30 min) instead of being retried immediately;
 * any other failure falls through to the next provider.
 *
 * RATE counters are shared with pycore (AiRateLimiter). Cooldown + per-provider
 * stats + recent task records are laravel-local runtime state, persisted under
 * the Laravel data dir (resolved via PathMapper, never raw storage_path()).
 */
class AiGateway
{
    private const COOLDOWN_BASE_S = 60.0;
    private const COOLDOWN_MAX_S = 1800.0;
    private const RECORDS_MAX = 100;
    private const QUOTA_TTL_S = 600.0;
    private const TIER_ORDER = ['free', 'balance', 'paid'];

    /** Error fragments meaning "rate limit / quota" -> cooldown, not plain fail. */
    private const QUOTA_ERROR_MARKS = [
        '429', 'rate limit', 'rate_limit', 'ratelimit', 'resource_exhausted',
        'quota', 'insufficient', 'overloaded', '402',
    ];

    /** @var array<string, array<string, mixed>>|null in-process quota cache */
    private static ?array $quotaCache = null;

    public static function usageFile(): string
    {
        return PathMapper::getLaravelDataDir('ai_gateway_usage.json');
    }

    // --- text dispatch ----------------------------------------------------- //

    /**
     * Text generation through the unified exit (prompts pass through unchanged).
     *
     * @param array<int, array<string, mixed>>|null $messages
     */
    public static function generateText(
        ?string $prompt = null,
        ?array $messages = null,
        ?string $model = null,
        ?string $provider = null,
        string $source = ''
    ): array {
        $msgs = $messages ?: ($prompt ? [['role' => 'user', 'content' => $prompt]] : []);
        if (empty($msgs)) {
            $out = self::noProvider($provider ?? '');
            $out['error'] = 'No prompt/messages provided';
            return $out;
        }

        $chain = self::candidates($provider);
        if (empty($chain)) {
            $out = self::noProvider($provider ?? '');
            self::record('text', $source, $out);
            return $out;
        }

        $last = [];
        $count = count($chain);
        foreach ($chain as $i => $name) {
            $useModel = ($i === 0 && $model) ? $model : null;
            $last = AiChat::chatOnce($name, $msgs, $useModel, $source);
            self::onResult($name, !empty($last['success']), $last['error'] ?? null);
            if (!empty($last['success'])) {
                self::record('text', $source, $last);
                return $last;
            }
        }
        self::record('text', $source, $last);
        return $last ?: self::noProvider($provider ?? '');
    }

    /**
     * Ordered provider fallback chain for one call: tier order within
     * PROVIDER_ORDER, configured + not-in-cooldown only, prefer pinned first.
     *
     * @return string[]
     */
    private static function candidates(?string $prefer, ?string $capability = null): array
    {
        $usable = static function (string $name) use ($capability): bool {
            if (!AiProviderRegistry::isConfigured($name) || self::inCooldown($name)) {
                return false;
            }
            if ($capability) {
                return (bool) (AiProviderRegistry::meta($name)[$capability] ?? false);
            }
            // Text/chat chain (no capability): never pick an image-only provider.
            return !AiProviderRegistry::isImageOnly($name);
        };

        $ordered = [];
        $prefer = $prefer ? strtolower(trim($prefer)) : '';
        if ($prefer && $prefer !== 'auto' && AiProviderRegistry::exists($prefer) && $usable($prefer)) {
            $ordered[] = $prefer;
        }
        foreach (self::TIER_ORDER as $tier) {
            foreach (AiProviderRegistry::orderedNames() as $name) {
                if (in_array($name, $ordered, true) || AiProviderRegistry::tier($name) !== $tier) {
                    continue;
                }
                if ($usable($name)) {
                    $ordered[] = $name;
                }
            }
        }
        return $ordered;
    }

    private static function noProvider(string $provider = ''): array
    {
        return [
            'success' => false,
            'provider' => $provider,
            'model' => '',
            'text' => '',
            'latency_ms' => null,
            'error' => 'No AI provider available (configure a key / wait out cooldowns)',
        ];
    }

    // --- image generation -------------------------------------------------- //

    /**
     * generateImage() preference: genuinely-FREE image backends first (pollinations
     * keyless, cloudflare SDXL, siliconflow FLUX, zhipu cogview-3-flash, gemini
     * flash image, dashscope wanx free-trial, baidu iRAG, openrouter), then
     * metered/paid (openai, stepfun, volcano). Lower rank = tried first; unknown
     * sorts last. Mirrors pycore _IMAGE_PREFERENCE intent (free before paid).
     */
    private const IMAGE_PREFERENCE = [
        'gemini' => 0, 'zhipuai' => 1, 'dashscope' => 2, 'qianfan' => 3,
        'cloudflare' => 4, 'siliconflow' => 5,
        'pollinations' => 6,  // free + NO key -> reliable guaranteed fallback
        'volcano' => 7, 'spark' => 8, 'openrouter' => 9,
        'imagen' => 10, 'azure' => 11, 'openai' => 12, 'stepfun' => 13,
        'bedrock' => 14, 'vertex' => 15,
    ];

    /** Per-provider pixel-size menus (square / landscape / portrait). */
    private const IMAGE_SIZES = [
        'openai'      => ['square' => '1024x1024', 'landscape' => '1792x1024', 'portrait' => '1024x1792'],
        'zhipuai'     => ['square' => '1024x1024', 'landscape' => '1344x768',  'portrait' => '768x1344'],
        'dashscope'   => ['square' => '1024*1024', 'landscape' => '1280*720',  'portrait' => '720*1280'],
        'stepfun'     => ['square' => '1024x1024', 'landscape' => '1280x800',  'portrait' => '800x1280'],
        'qianfan'     => ['square' => '1024x1024', 'landscape' => '1024x768',  'portrait' => '768x1024'],
        'siliconflow' => ['square' => '1024x1024', 'landscape' => '1280x720',  'portrait' => '720x1280'],
        'volcano'     => ['square' => '1024x1024', 'landscape' => '1280x720',  'portrait' => '720x1280'],
    ];

    /** Pollinations takes width/height as separate ints (kept apart from the
     *  string-typed IMAGE_SIZES so providerImageSize never stringifies an array). */
    private const POLLINATIONS_SIZES = [
        'square' => [1024, 1024], 'landscape' => [1280, 720], 'portrait' => [720, 1280],
    ];

    /**
     * Generate one image through the unified exit (image-capable providers only,
     * per the registry image flag). Free backends are tried before paid; each
     * provider does multi-key failover internally. Returns:
     *   { success, provider, model, image_base64, mime, latency_ms, error }
     */
    public static function generateImage(string $prompt, ?string $size = null, ?string $model = null, string $source = 'image'): array
    {
        $chain = self::candidates(null, 'image');
        // Free image backends first so a working free key is never skipped in
        // favour of a chargeable provider.
        usort($chain, static fn ($a, $b) => (self::IMAGE_PREFERENCE[$a] ?? 99) <=> (self::IMAGE_PREFERENCE[$b] ?? 99));

        // Skip providers whose image keys are ALL on cooldown (recently
        // dead/blocked/rate-limited) so they don't stall the request — mirrors
        // pycore image_ready_now. If EVERYTHING is cooled, keep the full set
        // (cooldowns may be near expiry; one attempt beats a blank result).
        $ready = array_values(array_filter($chain, static function ($name) {
            $keys = AiProviderRegistry::isKeyless($name) ? [''] : AiProviderRegistry::allImageSecrets($name);
            if (empty($keys)) {
                $keys = [''];
            }
            return AiKeyRotation::hasReadyKey($name . '#image', $keys);
        }));
        if (!empty($ready)) {
            $chain = $ready;
        }

        $out = [
            'success' => false, 'provider' => '', 'model' => '',
            'image_base64' => null, 'mime' => null, 'latency_ms' => null, 'error' => null,
        ];
        if (empty($chain)) {
            $out['error'] = 'No image-capable AI provider available (configure a key / wait out cooldowns)';
            self::record('image', $source, $out);
            return $out;
        }

        foreach ($chain as $i => $name) {
            $start = microtime(true);
            $res = self::imageOnce($name, $prompt, $size, ($i === 0 ? $model : null));
            $res['latency_ms'] = round((microtime(true) - $start) * 1000, 1);
            self::onResult($name, !empty($res['success']), $res['error'] ?? null);
            if (!empty($res['success'])) {
                // NOTE: image generation is intentionally NOT recorded against the
                // SHARED ai_rate_usage.json — pycore doesn't either (it isolates
                // image via per-key rotation), and the shared per-provider counter
                // gates TEXT chat, so counting images there would (a) diverge from
                // pycore's writes and (b) let images starve text. Image throttling
                // relies on the provider's own 429 -> gateway cooldown.
                self::record('image', $source, $res);
                return $res;
            }
            $out = $res;
        }
        self::record('image', $source, $out);
        return $out;
    }

    /**
     * One image generation against a single provider, with multi-key failover.
     *
     * NOT gated by the shared text rate budget (see generateImage) — pycore
     * isolates image from the shared counter, so we mirror that. Keys are taken
     * from allImageSecrets() (dedicated _IMAGE keys first, then normal keys); on
     * an AUTH/QUOTA failure the next key is tried, on success or any other error
     * we stop. Keyless providers (pollinations) run a single keyless dispatch.
     */
    private static function imageOnce(string $provider, string $prompt, ?string $size, ?string $model): array
    {
        $out = [
            'success' => false, 'provider' => $provider, 'model' => '',
            'image_base64' => null, 'mime' => null, 'latency_ms' => null, 'error' => null,
        ];

        $keys = AiProviderRegistry::isKeyless($provider) ? [''] : AiProviderRegistry::allImageSecrets($provider);
        if (empty($keys)) {
            // A provider may authenticate via aux secrets rather than a key_base
            // value (e.g. vertex with VERTEX_ACCESS_TOKEN, no SA JSON). If it's
            // otherwise configured, run one dispatch and let the backend resolve
            // its own auth; otherwise there is genuinely no key.
            if (AiProviderRegistry::isConfigured($provider)) {
                $keys = [''];
            } else {
                $out['error'] = 'No API key configured';
                return $out;
            }
        }

        $useModel = $model ?: AiProviderRegistry::imageModel($provider);
        $out['model'] = $useModel;
        $client = AiProviderRegistry::client($provider);

        // Per-key rotation under a SEPARATE "<provider>#image" budget so image
        // cooldowns never block text and vice-versa (mirrors pycore). On an
        // AUTH/QUOTA error cool that key so it's skipped next time, then rotate.
        $rotKey = $provider . '#image';
        [$rpm, $rpd] = AiRateLimiter::perKeyCaps($provider, $useModel);
        $n = count($keys);
        for ($attempt = 0; $attempt < $n; $attempt++) {
            [$idx, $key] = AiKeyRotation::selectActive($rotKey, $keys);
            if (!AiKeyRotation::rateOk($rotKey, $idx, $rpm, $rpd)) {
                if ($attempt + 1 < $n) {
                    AiKeyRotation::markCooldown($rotKey, $idx, 30, 'per-key rate budget');
                    continue;
                }
                $out['error'] = 'per-key rate budget reached (all keys)';
                break;
            }
            $out['success'] = false;
            $out['error'] = null;
            try {
                self::imageDispatch($client, $provider, $prompt, $size, $useModel, $key, $out);
            } catch (\Throwable $e) {
                $out['error'] = $e->getMessage();
            }
            AiKeyRotation::record($rotKey, $idx, !empty($out['success']), $out['error'] ?? null);
            if (!empty($out['success'])) {
                break;
            }
            if (self::isAuthOrQuotaError($out['error'] ?? null)) {
                AiKeyRotation::markCooldown($rotKey, $idx, null, $out['error'] ?? null);
                if ($attempt + 1 < $n) {
                    continue;
                }
            }
            break;
        }
        return $out;
    }

    /** Route an image generation to the matching provider backend. */
    private static function imageDispatch(string $client, string $provider, string $prompt, ?string $size, string $model, string $key, array &$out): void
    {
        switch ($client) {
            case 'gemini':
                self::imageGemini($provider, $prompt, $model, $key, $out);
                return;
            case 'imagen':
                self::imageImagen($provider, $prompt, $size, $model, $key, $out);
                return;
            case 'cloudflare':
                self::imageCloudflare($provider, $prompt, $model, $key, $out);
                return;
            case 'pollinations':
                self::imagePollinations($provider, $prompt, $size, $out);
                return;
            case 'spark':
                // iFlytek Spark tti: HMAC host/date/request-line signing with the
                // SPARK_APP_ID/API_KEY/API_SECRET triple (NOT the chat api_password).
                self::imageSpark($prompt, $size, $model, $out);
                return;
            case 'azure':
                self::imageAzure($prompt, $size, $model, $key, $out);
                return;
            case 'vertex':
                self::imageVertex($provider, $prompt, $model, $key, $out);
                return;
            case 'bedrock':
                self::imageBedrock($provider, $prompt, $model, $key, $out);
                return;
            default:
                // OpenAI-compatible family, routed by provider:
                //   zhipuai / qianfan / dashscope return a URL (or async task);
                //   openai / siliconflow / stepfun / volcano return b64_json|url;
                //   openrouter uses chat-completions with image modalities.
                self::imageCompatRouted($provider, $prompt, $size, $model, $key, $out);
        }
    }

    // --- per-provider image backends (ported from pycore _generate_image_with_*) //

    /** Gemini inline-b64 generateContent (TEXT,IMAGE modalities). */
    private static function imageGemini(string $provider, string $prompt, string $model, string $key, array &$out): void
    {
        $url = AiProviderRegistry::baseUrl($provider) . '/models/' . rawurlencode($model) . ':generateContent?key=' . urlencode($key);
        $resp = Http::withHeaders(['Content-Type' => 'application/json'])->timeout(120)->post($url, [
            'contents' => [['parts' => [['text' => $prompt]]]],
            'generationConfig' => ['responseModalities' => ['TEXT', 'IMAGE']],
        ]);
        if ($resp->status() !== 200) {
            $out['error'] = 'HTTP ' . $resp->status() . ': ' . mb_substr($resp->body(), 0, 300);
            return;
        }
        foreach ($resp->json()['candidates'][0]['content']['parts'] ?? [] as $part) {
            if (isset($part['inlineData']['data'])) {
                $out['image_base64'] = $part['inlineData']['data'];
                $out['mime'] = $part['inlineData']['mimeType'] ?? 'image/png';
                $out['success'] = true;
                return;
            }
        }
        $out['error'] = 'No image returned by provider';
    }

    /**
     * OpenAI-compatible image family + the URL/async/chat variants:
     *   openrouter  -> chat/completions (modalities image,text) -> inline data-URI
     *   dashscope   -> ASYNC native text2image (submit + poll) -> URL
     *   zhipuai/qianfan -> /images/generations -> URL (download)
     *   openai/siliconflow/stepfun/volcano -> /images/generations -> b64_json|url
     */
    private static function imageCompatRouted(string $provider, string $prompt, ?string $size, string $model, string $key, array &$out): void
    {
        if ($provider === 'openrouter') {
            self::imageOpenRouter($provider, $prompt, $model, $key, $out);
            return;
        }
        if ($provider === 'dashscope') {
            self::imageDashscope($prompt, $size, $model, $key, $out);
            return;
        }
        if ($provider === 'zhipuai' || $provider === 'qianfan') {
            self::imageUrlGenerations($provider, $prompt, $size, $model, $key, $out);
            return;
        }
        // openai / siliconflow / stepfun / volcano — b64_json (else url) generations.
        self::imageB64Generations($provider, $prompt, $size, $model, $key, $out);
    }

    /** OpenAI-style /images/generations expecting b64_json (falls back to url). */
    private static function imageB64Generations(string $provider, string $prompt, ?string $size, string $model, string $key, array &$out): void
    {
        $body = ['model' => $model, 'prompt' => $prompt, 'n' => 1];
        if (isset(self::IMAGE_SIZES[$provider])) {
            $body['size'] = self::providerImageSize($provider, $size);
        }
        // dall-e-* need response_format to return base64; gpt-image-1 rejects it.
        if (str_starts_with($model, 'dall-e') || $provider !== 'openai') {
            $body['response_format'] = 'b64_json';
        }
        $resp = Http::withHeaders(['Authorization' => 'Bearer ' . $key, 'Content-Type' => 'application/json'])
            ->timeout(120)->post(AiProviderRegistry::baseUrl($provider) . '/images/generations', $body);
        if ($resp->status() !== 200) {
            $out['error'] = 'HTTP ' . $resp->status() . ': ' . mb_substr($resp->body(), 0, 200);
            return;
        }
        $entry = ($resp->json()['data'] ?? [])[0] ?? [];
        if (!empty($entry['b64_json'])) {
            $out['image_base64'] = $entry['b64_json'];
            $out['mime'] = 'image/png';
            $out['success'] = true;
            return;
        }
        if (!empty($entry['url'])) {
            [$b64, $mime] = self::fetchImageB64($entry['url']);
            if ($b64 !== '') {
                $out['image_base64'] = $b64;
                $out['mime'] = $mime;
                $out['success'] = true;
                return;
            }
        }
        $out['error'] = 'Empty response from provider';
    }

    /** OpenAI-style /images/generations that returns a URL (zhipu cogview, qianfan iRAG). */
    private static function imageUrlGenerations(string $provider, string $prompt, ?string $size, string $model, string $key, array &$out): void
    {
        $resp = Http::withHeaders(['Authorization' => 'Bearer ' . $key, 'Content-Type' => 'application/json'])
            ->timeout(120)->post(AiProviderRegistry::baseUrl($provider) . '/images/generations', [
                'model' => $model,
                'prompt' => $prompt,
                'size' => self::providerImageSize($provider, $size),
            ]);
        if ($resp->status() !== 200) {
            $out['error'] = 'HTTP ' . $resp->status() . ': ' . mb_substr($resp->body(), 0, 200);
            return;
        }
        $url = (($resp->json()['data'] ?? [])[0]['url'] ?? '');
        [$b64, $mime] = self::fetchImageB64((string) $url);
        if ($b64 !== '') {
            $out['image_base64'] = $b64;
            $out['mime'] = $mime;
            $out['success'] = true;
        } else {
            $out['error'] = 'Empty / unfetchable image response from provider';
        }
    }

    /** OpenRouter image — chat/completions with modalities:[image,text] -> data-URI. */
    private static function imageOpenRouter(string $provider, string $prompt, string $model, string $key, array &$out): void
    {
        $resp = Http::withHeaders(array_merge(
            ['Authorization' => 'Bearer ' . $key, 'Content-Type' => 'application/json'],
            AiProviderRegistry::extraHeaders($provider)
        ))->timeout(120)->post(AiProviderRegistry::baseUrl($provider) . '/chat/completions', [
            'model' => $model,
            'messages' => [['role' => 'user', 'content' => $prompt]],
            'modalities' => ['image', 'text'],
        ]);
        if ($resp->status() !== 200) {
            $out['error'] = 'HTTP ' . $resp->status() . ': ' . mb_substr($resp->body(), 0, 200);
            return;
        }
        $msg = ($resp->json()['choices'][0]['message'] ?? []);
        $url = (string) (($msg['images'][0]['image_url']['url'] ?? ''));
        if (str_starts_with($url, 'data:')) {
            [$head, $sep, $b64] = self::partition($url, ',');
            if ($b64 !== '') {
                $out['image_base64'] = $b64;
                $mime = substr($head, 5); // strip "data:"
                $mime = explode(';', $mime)[0];
                $out['mime'] = $mime !== '' ? $mime : 'image/png';
                $out['success'] = true;
                return;
            }
        }
        $out['error'] = 'Empty image response from provider';
    }

    /** DashScope Tongyi-Wanxiang (ASYNC): submit a task, poll until SUCCEEDED. */
    private static function imageDashscope(string $prompt, ?string $size, string $model, string $key, array &$out): void
    {
        $submit = Http::withHeaders([
            'Authorization' => 'Bearer ' . $key,
            'Content-Type' => 'application/json',
            'X-DashScope-Async' => 'enable',
        ])->timeout(30)->post('https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis', [
            'model' => $model,
            'input' => ['prompt' => $prompt],
            'parameters' => ['size' => self::providerImageSize('dashscope', $size), 'n' => 1],
        ]);
        if ($submit->status() !== 200) {
            $out['error'] = 'HTTP ' . $submit->status() . ': ' . mb_substr($submit->body(), 0, 200);
            return;
        }
        $taskId = ($submit->json()['output']['task_id'] ?? '');
        if ($taskId === '') {
            $out['error'] = 'no task_id returned';
            return;
        }
        // Poll (capped ~60s). Low-preference backup, so the bounded wait is rare.
        $deadline = microtime(true) + 60.0;
        $tries = 0;
        while (microtime(true) < $deadline && $tries < 30) {
            $tries++;
            usleep(2_000_000); // 2s
            $poll = Http::withHeaders(['Authorization' => 'Bearer ' . $key])->timeout(20)
                ->get('https://dashscope.aliyuncs.com/api/v1/tasks/' . $taskId);
            if ($poll->status() !== 200) {
                continue;
            }
            $output = ($poll->json()['output'] ?? []);
            $status = (string) ($output['task_status'] ?? '');
            if ($status === 'SUCCEEDED') {
                $url = (string) (($output['results'][0]['url'] ?? ''));
                [$b64, $mime] = self::fetchImageB64($url);
                if ($b64 !== '') {
                    $out['image_base64'] = $b64;
                    $out['mime'] = $mime;
                    $out['success'] = true;
                } else {
                    $out['error'] = 'task succeeded but image url missing/unfetchable';
                }
                return;
            }
            if ($status === 'FAILED') {
                $out['error'] = (string) ($output['message'] ?? 'synthesis task failed');
                return;
            }
        }
        $out['error'] = 'image synthesis task timed out';
    }

    /** Cloudflare Workers AI run endpoint — returns raw image bytes. */
    private static function imageCloudflare(string $provider, string $prompt, string $model, string $key, array &$out): void
    {
        $accountId = AiProviderRegistry::extraSecret($provider);
        if ($accountId === '') {
            $out['error'] = 'CLOUDFLARE_ACCOUNT_ID not configured';
            return;
        }
        $url = AiProviderRegistry::baseUrl($provider) . '/accounts/' . $accountId . '/ai/run/' . $model;
        $resp = Http::withHeaders(['Authorization' => 'Bearer ' . $key, 'Content-Type' => 'application/json'])
            ->timeout(120)->post($url, ['prompt' => $prompt]);
        if ($resp->status() !== 200) {
            $out['error'] = 'HTTP ' . $resp->status() . ': ' . mb_substr($resp->body(), 0, 200);
            return;
        }
        $bytes = $resp->body();
        // Some SDXL variants return JSON {result:{image: b64}} instead of raw bytes.
        if ($bytes !== '' && str_starts_with(ltrim($bytes), '{')) {
            $b64 = ($resp->json()['result']['image'] ?? '');
            if (is_string($b64) && $b64 !== '') {
                $out['image_base64'] = $b64;
                $out['mime'] = 'image/png';
                $out['success'] = true;
                return;
            }
        }
        if ($bytes !== '') {
            $out['image_base64'] = base64_encode($bytes);
            $mime = $resp->header('Content-Type');
            $out['mime'] = $mime ? explode(';', $mime)[0] : 'image/png';
            $out['success'] = true;
            return;
        }
        $out['error'] = 'Empty response from provider';
    }

    /** Pollinations — keyless GET /prompt/{prompt}?width=&height=&nologo=true -> bytes. */
    private static function imagePollinations(string $provider, string $prompt, ?string $size, array &$out): void
    {
        [$w, $h] = self::POLLINATIONS_SIZES[self::orientation($size)];
        $url = AiProviderRegistry::baseUrl($provider) . '/prompt/' . rawurlencode($prompt);
        $resp = Http::timeout(120)->get($url, [
            'width' => $w,
            'height' => $h,
            'nologo' => 'true',
        ]);
        if ($resp->status() !== 200) {
            $out['error'] = 'HTTP ' . $resp->status() . ': ' . mb_substr($resp->body(), 0, 200);
            return;
        }
        $bytes = $resp->body();
        if ($bytes === '') {
            $out['error'] = 'Empty response from provider';
            return;
        }
        $out['image_base64'] = base64_encode($bytes);
        $mime = $resp->header('Content-Type');
        $out['mime'] = $mime ? explode(';', $mime)[0] : 'image/jpeg';
        $out['success'] = true;
    }

    /**
     * iFlytek Spark text-to-image (tti v2.1). Ported from pycore
     * _generate_image_with_spark: host/date/request-line HMAC-SHA256 query-param
     * signing with the SPARK_APP_ID/API_KEY/API_SECRET triple (NOT the chat
     * api_password). The base64 PNG is returned inline at
     * payload.choices.text[0].content.
     */
    private static function imageSpark(string $prompt, ?string $size, string $model, array &$out): void
    {
        $appId = SecretStore::getIndexed('SPARK_APP_ID');
        $apiKey = SecretStore::getIndexed('SPARK_API_KEY');
        $apiSecret = SecretStore::getIndexed('SPARK_API_SECRET');
        if ($appId === '' || $apiKey === '' || $apiSecret === '') {
            $out['error'] = 'Spark image needs SPARK_APP_ID / SPARK_API_KEY / SPARK_API_SECRET';
            return;
        }

        $host = 'spark-api.cn-huabei-1.xf-yun.com';
        $path = '/v2.1/tti';
        // RFC 1123 / GMT date (matches Python email.utils.formatdate usegmt=True).
        $date = gmdate('D, d M Y H:i:s') . ' GMT';
        $origin = "host: {$host}\ndate: {$date}\nPOST {$path} HTTP/1.1";
        $signature = base64_encode(hash_hmac('sha256', $origin, $apiSecret, true));
        $authOrigin = 'api_key="' . $apiKey . '", algorithm="hmac-sha256", '
            . 'headers="host date request-line", signature="' . $signature . '"';
        $authorization = base64_encode($authOrigin);
        $url = 'https://' . $host . $path . '?'
            . 'authorization=' . rawurlencode($authorization)
            . '&date=' . rawurlencode($date)
            . '&host=' . $host;

        // Spark tti sizes (square / landscape / portrait), mirroring pycore _SPARK_SIZES.
        $sparkSizes = ['square' => [1024, 1024], 'landscape' => [1280, 720], 'portrait' => [720, 1280]];
        [$width, $height] = $sparkSizes[self::orientation($size)];

        $resp = Http::withHeaders(['Content-Type' => 'application/json'])->timeout(120)->post($url, [
            'header' => ['app_id' => $appId],
            'parameter' => ['chat' => ['domain' => 'general', 'width' => $width, 'height' => $height]],
            'payload' => ['message' => ['text' => [['role' => 'user', 'content' => $prompt]]]],
        ]);
        if ($resp->status() !== 200) {
            $out['error'] = 'HTTP ' . $resp->status() . ': ' . mb_substr($resp->body(), 0, 200);
            return;
        }
        $body = $resp->json() ?: [];
        $header = $body['header'] ?? [];
        if ((int) ($header['code'] ?? 0) !== 0) {
            $out['error'] = 'spark code ' . ($header['code'] ?? '?') . ': ' . ($header['message'] ?? '');
            return;
        }
        $b64 = $body['payload']['choices']['text'][0]['content'] ?? '';
        if ($b64 !== '') {
            $out['image_base64'] = $b64;
            $out['mime'] = 'image/png';
            $out['success'] = true;
        } else {
            $out['error'] = 'Empty response from provider';
        }
    }

    /**
     * Azure OpenAI DALL-E 3 image generation. Endpoint + deployment come from
     * secrets (AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_IMAGE_DEPLOYMENT), the API key
     * is sent as the `api-key` header. Returns data[0].b64_json (else data[0].url).
     */
    private static function imageAzure(string $prompt, ?string $size, string $model, string $key, array &$out): void
    {
        $endpoint = rtrim(trim(SecretStore::getIndexed('AZURE_OPENAI_ENDPOINT')), '/');
        $deployment = trim(SecretStore::getIndexed('AZURE_OPENAI_IMAGE_DEPLOYMENT'));
        if ($endpoint === '' || $deployment === '') {
            $out['error'] = 'Azure needs AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_IMAGE_DEPLOYMENT';
            return;
        }
        $url = $endpoint . '/openai/deployments/' . rawurlencode($deployment)
            . '/images/generations?api-version=2024-02-01';
        $resp = Http::withHeaders(['api-key' => $key, 'Content-Type' => 'application/json'])
            ->timeout(120)->post($url, [
                'prompt' => $prompt,
                'n' => 1,
                'size' => self::providerImageSize('openai', $size),
            ]);
        if ($resp->status() !== 200) {
            $out['error'] = 'HTTP ' . $resp->status() . ': ' . mb_substr($resp->body(), 0, 200);
            return;
        }
        $entry = ($resp->json()['data'] ?? [])[0] ?? [];
        if (!empty($entry['b64_json'])) {
            $out['image_base64'] = $entry['b64_json'];
            $out['mime'] = 'image/png';
            $out['success'] = true;
            return;
        }
        if (!empty($entry['url'])) {
            [$b64, $mime] = self::fetchImageB64($entry['url']);
            if ($b64 !== '') {
                $out['image_base64'] = $b64;
                $out['mime'] = $mime;
                $out['success'] = true;
                return;
            }
        }
        $out['error'] = 'Empty response from provider';
    }

    /**
     * Google Imagen 3 via the Gemini API key (generativelanguage :predict).
     * Mirrors pycore _generate_image_with_imagen — shares GOOGLE_API_KEY (or a
     * dedicated GOOGLE_API_KEY_IMAGE), returns predictions[0].bytesBase64Encoded.
     */
    private static function imageImagen(string $provider, string $prompt, ?string $size, string $model, string $key, array &$out): void
    {
        if ($key === '') {
            $out['error'] = 'No API key configured';
            return;
        }
        $useModel = $model ?: AiProviderRegistry::imageModel($provider);
        $out['model'] = $useModel;
        $aspect = ($size && preg_match('/^\d{1,2}:\d{1,2}$/', $size)) ? $size : '1:1';
        $url = AiProviderRegistry::baseUrl($provider) . '/models/' . rawurlencode($useModel)
            . ':predict?key=' . urlencode($key);
        $resp = Http::withHeaders(['Content-Type' => 'application/json'])->timeout(120)->post($url, [
            'instances' => [['prompt' => $prompt]],
            'parameters' => ['sampleCount' => 1, 'aspectRatio' => $aspect],
        ]);
        if ($resp->status() !== 200) {
            $out['error'] = 'HTTP ' . $resp->status() . ': ' . mb_substr($resp->body(), 0, 200);
            return;
        }
        $pred = ($resp->json()['predictions'] ?? [])[0] ?? [];
        $b64 = $pred['bytesBase64Encoded'] ?? '';
        if (is_string($b64) && $b64 !== '') {
            $out['image_base64'] = $b64;
            $out['mime'] = $pred['mimeType'] ?? 'image/png';
            $out['success'] = true;
        } else {
            $out['error'] = 'Empty response from provider';
        }
    }

    /**
     * Google Vertex AI Imagen :predict via SERVICE-ACCOUNT OAuth (mirrors pycore
     * _generate_image_with_vertex). The provider key is GOOGLE_VERTEX_SA_JSON
     * (full SA JSON) → minted into a short-lived access token; VERTEX_PROJECT_ID
     * is the extra_secret; VERTEX_REGION (default us-central1) is aux config. A raw
     * VERTEX_ACCESS_TOKEN aux secret is honored as a fallback (skips SA signing).
     */
    private static function imageVertex(string $provider, string $prompt, string $model, string $key, array &$out): void
    {
        $project = AiProviderRegistry::extraSecret($provider); // VERTEX_PROJECT_ID
        if ($project === '') {
            $out['error'] = 'Vertex needs VERTEX_PROJECT_ID';
            return;
        }
        $region = SecretStore::getIndexed('VERTEX_REGION');
        if ($region === '') {
            $region = 'us-central1';
        }

        // Auth: a raw access token (VERTEX_ACCESS_TOKEN) wins if provided; else mint
        // one from the service-account JSON (the provider key).
        $token = SecretStore::getIndexed('VERTEX_ACCESS_TOKEN');
        if ($token === '') {
            [$token, $err] = self::vertexAccessToken($key);
            if ($token === '') {
                $out['error'] = $err ?: 'Vertex needs GOOGLE_VERTEX_SA_JSON or VERTEX_ACCESS_TOKEN';
                return;
            }
        }

        $useModel = $model ?: AiProviderRegistry::imageModel($provider);
        $out['model'] = $useModel;
        $aspect = '1:1'; // size aspect not threaded into the vertex backend; default square
        $url = 'https://' . $region . '-aiplatform.googleapis.com/v1/projects/' . rawurlencode($project)
            . '/locations/' . $region . '/publishers/google/models/' . rawurlencode($useModel) . ':predict';
        $resp = Http::withHeaders(['Authorization' => 'Bearer ' . $token, 'Content-Type' => 'application/json'])
            ->timeout(120)->post($url, [
                'instances' => [['prompt' => $prompt]],
                'parameters' => ['sampleCount' => 1, 'aspectRatio' => $aspect],
            ]);
        if ($resp->status() !== 200) {
            $out['error'] = 'HTTP ' . $resp->status() . ': ' . mb_substr($resp->body(), 0, 200);
            return;
        }
        $pred = ($resp->json()['predictions'] ?? [])[0] ?? [];
        $b64 = $pred['bytesBase64Encoded'] ?? '';
        if (is_string($b64) && $b64 !== '') {
            $out['image_base64'] = $b64;
            $out['mime'] = $pred['mimeType'] ?? 'image/png';
            $out['success'] = true;
        } else {
            $out['error'] = 'Empty response from provider';
        }
    }

    /**
     * Mint a short-lived GCP access token from a service-account JSON via a signed
     * RS256 JWT (jwt-bearer assertion grant). Returns [token, errorOrNull].
     * Requires the openssl extension and the SA's private_key + client_email.
     */
    private static function vertexAccessToken(string $saJson): array
    {
        $sa = json_decode($saJson, true);
        if (!is_array($sa) || empty($sa['client_email']) || empty($sa['private_key'])) {
            return ['', 'invalid GOOGLE_VERTEX_SA_JSON (need client_email + private_key)'];
        }
        $tokenUri = $sa['token_uri'] ?? 'https://oauth2.googleapis.com/token';
        $now = time();
        $b64u = static fn (string $d): string => rtrim(strtr(base64_encode($d), '+/', '-_'), '=');
        $segments = $b64u((string) json_encode(['alg' => 'RS256', 'typ' => 'JWT']))
            . '.' . $b64u((string) json_encode([
                'iss' => $sa['client_email'],
                'scope' => 'https://www.googleapis.com/auth/cloud-platform',
                'aud' => $tokenUri,
                'iat' => $now,
                'exp' => $now + 3600,
            ]));
        $sig = '';
        if (!@openssl_sign($segments, $sig, $sa['private_key'], OPENSSL_ALGO_SHA256)) {
            return ['', 'JWT signing failed (check openssl + SA private_key)'];
        }
        try {
            $resp = Http::asForm()->timeout(20)->post($tokenUri, [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $segments . '.' . $b64u($sig),
            ]);
            if ($resp->status() !== 200) {
                return ['', 'token exchange HTTP ' . $resp->status() . ': ' . mb_substr($resp->body(), 0, 150)];
            }
            $tok = $resp->json()['access_token'] ?? '';
            return [is_string($tok) ? $tok : '', is_string($tok) && $tok !== '' ? null : 'no access_token in response'];
        } catch (\Throwable $e) {
            return ['', $e->getMessage()];
        }
    }

    /**
     * AWS Bedrock Titan image generator (:invoke), signed with AWS SigV4. The key
     * is the AWS access key id; the secret access key is the extra_secret
     * (AWS_SECRET_ACCESS_KEY); region from AWS_REGION (default us-east-1).
     * Returns images[0] (b64 PNG). Best-effort: SigV4 is implemented from the
     * canonical-request -> string-to-sign -> signing-key spec but untested live.
     */
    private static function imageBedrock(string $provider, string $prompt, string $model, string $key, array &$out): void
    {
        $accessKey = $key; // AWS_ACCESS_KEY_ID
        $secretKey = AiProviderRegistry::extraSecret($provider); // AWS_SECRET_ACCESS_KEY
        if ($accessKey === '' || $secretKey === '') {
            $out['error'] = 'Bedrock needs AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY';
            return;
        }
        $region = SecretStore::getIndexed('AWS_REGION');
        if ($region === '') {
            $region = 'us-east-1';
        }
        $service = 'bedrock';
        $host = 'bedrock-runtime.' . $region . '.amazonaws.com';
        $canonicalUri = '/model/' . rawurlencode($model) . '/invoke';
        $payload = json_encode([
            'taskType' => 'TEXT_IMAGE',
            'textToImageParams' => ['text' => $prompt],
            'imageGenerationConfig' => ['numberOfImages' => 1],
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        $now = time();
        $amzDate = gmdate('Ymd\THis\Z', $now);
        $dateStamp = gmdate('Ymd', $now);
        $contentType = 'application/json';
        $payloadHash = hash('sha256', $payload);

        // --- SigV4 canonical request ---
        $canonicalHeaders = "content-type:{$contentType}\nhost:{$host}\nx-amz-date:{$amzDate}\n";
        $signedHeaders = 'content-type;host;x-amz-date';
        $canonicalRequest = "POST\n{$canonicalUri}\n\n{$canonicalHeaders}\n{$signedHeaders}\n{$payloadHash}";

        // --- string to sign ---
        $algorithm = 'AWS4-HMAC-SHA256';
        $credentialScope = "{$dateStamp}/{$region}/{$service}/aws4_request";
        $stringToSign = "{$algorithm}\n{$amzDate}\n{$credentialScope}\n" . hash('sha256', $canonicalRequest);

        // --- signing key ---
        $kDate = hash_hmac('sha256', $dateStamp, 'AWS4' . $secretKey, true);
        $kRegion = hash_hmac('sha256', $region, $kDate, true);
        $kService = hash_hmac('sha256', $service, $kRegion, true);
        $kSigning = hash_hmac('sha256', 'aws4_request', $kService, true);
        $signature = hash_hmac('sha256', $stringToSign, $kSigning);

        $authorization = "{$algorithm} Credential={$accessKey}/{$credentialScope}, "
            . "SignedHeaders={$signedHeaders}, Signature={$signature}";

        $resp = Http::withHeaders([
            'Authorization' => $authorization,
            'X-Amz-Date' => $amzDate,
            'Content-Type' => $contentType,
            'Accept' => 'application/json',
        ])->timeout(120)->withBody($payload, $contentType)
            ->post('https://' . $host . $canonicalUri);
        if ($resp->status() !== 200) {
            $out['error'] = 'HTTP ' . $resp->status() . ': ' . mb_substr($resp->body(), 0, 200);
            return;
        }
        $b64 = $resp->json()['images'][0] ?? '';
        if (is_string($b64) && $b64 !== '') {
            $out['image_base64'] = $b64;
            $out['mime'] = 'image/png';
            $out['success'] = true;
        } else {
            $out['error'] = 'Empty response from provider';
        }
    }

    // --- image helpers ----------------------------------------------------- //

    /** Square / landscape / portrait from the gateway aspect shape ('W:H'). */
    private static function orientation(?string $aspect): string
    {
        if (!$aspect || !preg_match('/^\d{1,2}:\d{1,2}$/', $aspect)) {
            return 'square';
        }
        [$w, $h] = array_map('intval', explode(':', $aspect));
        if ($w === $h) {
            return 'square';
        }
        return $w > $h ? 'landscape' : 'portrait';
    }

    /** Nearest provider-supported pixel size string for the requested aspect. */
    private static function providerImageSize(string $provider, ?string $aspect): string
    {
        $menu = self::IMAGE_SIZES[$provider] ?? self::IMAGE_SIZES['openai'];
        return (string) $menu[self::orientation($aspect)];
    }

    /**
     * Download an image URL (providers that return a URL, not inline base64) and
     * return [base64, mime]. Returns ['', ''] on any failure.
     *
     * @return array{0: string, 1: string}
     */
    private static function fetchImageB64(string $url): array
    {
        if ($url === '') {
            return ['', ''];
        }
        try {
            $resp = Http::timeout(60)->get($url);
            if ($resp->status() !== 200 || $resp->body() === '') {
                return ['', ''];
            }
            $mime = $resp->header('Content-Type');
            $mime = $mime ? trim(explode(';', $mime)[0]) : 'image/png';
            return [base64_encode($resp->body()), $mime !== '' ? $mime : 'image/png'];
        } catch (\Throwable $e) {
            return ['', ''];
        }
    }

    /** str.partition equivalent: split on first $sep -> [before, sep, after]. */
    private static function partition(string $s, string $sep): array
    {
        $pos = strpos($s, $sep);
        if ($pos === false) {
            return [$s, '', ''];
        }
        return [substr($s, 0, $pos), $sep, substr($s, $pos + strlen($sep))];
    }

    /** Error fragments meaning AUTH / QUOTA — trigger image-key rotation. */
    private const IMAGE_AUTH_QUOTA_MARKS = [
        'http 401', 'http 403', 'http 429',
        'rate limit', 'rate_limit', 'ratelimit',
        'quota', 'insufficient', 'overloaded', 'invalid api key', 'invalid_api_key',
    ];

    /** True for an AUTH/QUOTA failure (the signal to try the NEXT image key). */
    private static function isAuthOrQuotaError(?string $error): bool
    {
        $e = strtolower((string) $error);
        if ($e === '') {
            return false;
        }
        foreach (self::IMAGE_AUTH_QUOTA_MARKS as $mark) {
            if (str_contains($e, $mark)) {
                return true;
            }
        }
        return false;
    }

    // --- cooldown + stats + records ---------------------------------------- //

    private static function isQuotaError(?string $error): bool
    {
        $e = strtolower((string) $error);
        foreach (self::QUOTA_ERROR_MARKS as $mark) {
            if ($e !== '' && str_contains($e, $mark)) {
                return true;
            }
        }
        return false;
    }

    private static function onResult(string $provider, bool $ok, ?string $error): void
    {
        $data = self::loadStats();
        $st = $data['stats'][$provider] ?? self::blankStat();
        $st['calls']++;
        $st['last_used'] = microtime(true);
        if ($ok) {
            $st['ok']++;
            $st['strikes'] = 0;
            $st['last_error'] = null;
        } else {
            $st['failed']++;
            $st['last_error'] = $error;
            if (self::isQuotaError($error)) {
                $st['strikes']++;
                $cooldown = min(self::COOLDOWN_BASE_S * (2 ** ($st['strikes'] - 1)), self::COOLDOWN_MAX_S);
                $st['cooldown_until'] = microtime(true) + $cooldown;
            }
        }
        $data['stats'][$provider] = $st;
        self::saveStats($data);
    }

    private static function inCooldown(string $provider): bool
    {
        $st = self::loadStats()['stats'][$provider] ?? null;
        return $st !== null && microtime(true) < (float) ($st['cooldown_until'] ?? 0.0);
    }

    /** Reset cooldown for providers whose window has elapsed. */
    public static function clearExpiredCooldowns(): array
    {
        $now = microtime(true);
        $cleared = [];
        $data = self::loadStats();
        foreach ($data['stats'] as $name => &$st) {
            if (!empty($st['cooldown_until']) && $now >= $st['cooldown_until']) {
                $st['cooldown_until'] = 0.0;
                $st['strikes'] = 0;
                $cleared[] = $name;
            }
        }
        unset($st);
        if (!empty($cleared)) {
            self::saveStats($data);
        }
        return ['cleared' => $cleared];
    }

    /**
     * Drop the in-process quota cache (live OpenRouter/DeepSeek snapshots). Called
     * after a key is set/deleted so the next /gateway?refresh reflects the change
     * instead of a stale 600s-cached snapshot tied to the old key.
     */
    public static function invalidateCaches(): void
    {
        self::$quotaCache = null;
    }

    private static function record(string $kind, string $source, array $result): void
    {
        $data = self::loadStats();
        $data['records'][] = [
            'ts' => microtime(true),
            'kind' => $kind,
            'source' => $source,
            'provider' => $result['provider'] ?? '',
            'model' => $result['model'] ?? '',
            'success' => (bool) ($result['success'] ?? false),
            'latency_ms' => $result['latency_ms'] ?? null,
            'error' => $result['error'] ?? null,
        ];
        if (count($data['records']) > self::RECORDS_MAX) {
            $data['records'] = array_slice($data['records'], -self::RECORDS_MAX);
        }
        self::saveStats($data);
    }

    /**
     * Full gateway snapshot for the UI: per-provider tier/quota/usage/cooldown
     * and the recent task records (newest first). Live quota (OpenRouter key
     * usage / DeepSeek balance) is only fetched when $refresh is true; otherwise
     * a static descriptor is returned so the 5s UI poll never hits the network.
     */
    public static function gatewayStatus(bool $refresh = false): array
    {
        $data = self::loadStats();
        $now = microtime(true);
        $providers = [];
        foreach (AiProviderRegistry::orderedNames() as $name) {
            $meta = AiProviderRegistry::meta($name);
            $st = $data['stats'][$name] ?? self::blankStat();
            $configured = AiProviderRegistry::isConfigured($name);
            $cooldownS = max(0.0, (float) ($st['cooldown_until'] ?? 0.0) - $now);
            $providers[] = [
                'name' => $name,
                'tier' => $meta['tier'] ?? 'paid',
                'limits' => $meta['limits'] ?? '',
                'vision' => $meta['vision'] ?? false,
                'image' => $meta['image'] ?? false,
                'image_model' => ($meta['image'] ?? false) ? (string) ($meta['image_model'] ?? '') : '',
                'image_ready' => (bool) ($meta['image'] ?? false) && AiProviderRegistry::hasImageKey($name),
                'configured' => $configured,
                // Best-effort: a configured provider not in cooldown is considered
                // available here; the per-card Test button runs the real probe.
                'available' => $configured && $cooldownS <= 0,
                'key_masked' => $configured ? SecretStore::maskForDisplay(AiProviderRegistry::firstSecret($name)) : null,
                'models' => AiProviderRegistry::catalogModels($name, 5),
                'quota' => self::getQuota($name, $refresh),
                'calls' => (int) $st['calls'],
                'ok' => (int) $st['ok'],
                'failed' => (int) $st['failed'],
                'last_error' => $st['last_error'],
                'cooldown_s' => round($cooldownS, 1),
            ];
        }
        // Newest first.
        $records = array_reverse($data['records']);
        return ['success' => true, 'providers' => $providers, 'records' => $records];
    }

    /** Quota/limit snapshot for one provider (TTL-cached in-process). */
    public static function getQuota(string $provider, bool $refresh = false): array
    {
        $now = microtime(true);
        if (self::$quotaCache === null) {
            self::$quotaCache = [];
        }
        $cached = self::$quotaCache[$provider] ?? null;
        if ($cached && !$refresh && ($now - $cached['ts']) < self::QUOTA_TTL_S) {
            return $cached['quota'];
        }

        $key = AiProviderRegistry::firstSecret($provider);
        if ($key === '') {
            $quota = ['kind' => 'none', 'note' => 'No API key configured'];
        } elseif ($refresh && $provider === 'openrouter') {
            $quota = self::quotaOpenRouter($key);
        } elseif ($refresh && $provider === 'deepseek') {
            $quota = self::quotaDeepSeek($key);
        } else {
            $isFree = AiProviderRegistry::tier($provider) === 'free';
            $quota = ['kind' => 'static', 'is_free_tier' => $isFree, 'note' => AiProviderRegistry::limitsNote($provider)];
        }

        self::$quotaCache[$provider] = ['ts' => $now, 'quota' => $quota];
        return $quota;
    }

    private static function quotaOpenRouter(string $key): array
    {
        try {
            $resp = Http::withHeaders(['Authorization' => 'Bearer ' . $key])->timeout(15)
                ->get('https://openrouter.ai/api/v1/key');
            if ($resp->status() !== 200) {
                return ['kind' => 'key-usage', 'error' => 'HTTP ' . $resp->status()];
            }
            $d = $resp->json()['data'] ?? [];
            return [
                'kind' => 'key-usage',
                'is_free_tier' => (bool) ($d['is_free_tier'] ?? false),
                'usage' => $d['usage'] ?? null,
                'limit' => $d['limit'] ?? null,
                'limit_remaining' => $d['limit_remaining'] ?? null,
                'rate_limit' => $d['rate_limit'] ?? null,
                'note' => ':free models: 20 req/min; 50/day (<10 credits) or 1000/day',
            ];
        } catch (\Throwable $e) {
            return ['kind' => 'key-usage', 'error' => $e->getMessage()];
        }
    }

    private static function quotaDeepSeek(string $key): array
    {
        try {
            $resp = Http::withHeaders(['Authorization' => 'Bearer ' . $key])->timeout(15)
                ->get('https://api.deepseek.com/user/balance');
            if ($resp->status() !== 200) {
                return ['kind' => 'balance', 'error' => 'HTTP ' . $resp->status()];
            }
            $d = $resp->json();
            $first = $d['balance_infos'][0] ?? [];
            return [
                'kind' => 'balance',
                'is_available' => (bool) ($d['is_available'] ?? false),
                'balance' => $first['total_balance'] ?? null,
                'currency' => $first['currency'] ?? null,
            ];
        } catch (\Throwable $e) {
            return ['kind' => 'balance', 'error' => $e->getMessage()];
        }
    }

    // --- persistence ------------------------------------------------------- //

    private static function blankStat(): array
    {
        return ['calls' => 0, 'ok' => 0, 'failed' => 0, 'last_used' => null, 'last_error' => null, 'cooldown_until' => 0.0, 'strikes' => 0];
    }

    /** @return array{stats: array<string, mixed>, records: array<int, mixed>} */
    private static function loadStats(): array
    {
        $path = self::usageFile();
        if (is_file($path)) {
            $raw = @file_get_contents($path);
            if ($raw !== false && $raw !== '') {
                $decoded = json_decode($raw, true);
                if (is_array($decoded)) {
                    return [
                        'stats' => is_array($decoded['stats'] ?? null) ? $decoded['stats'] : [],
                        'records' => is_array($decoded['records'] ?? null) ? $decoded['records'] : [],
                    ];
                }
            }
        }
        return ['stats' => [], 'records' => []];
    }

    private static function saveStats(array $data): void
    {
        $path = self::usageFile();
        $dir = dirname($path);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $tmp = $path . '.tmp.' . getmypid();
        if (@file_put_contents($tmp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) !== false) {
            @rename($tmp, $path);
        }
    }
}
