<?php

namespace App\Services\AiGateway;

use App\Providers\PathMapper;
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
            return true;
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
     * Generate one image through the unified exit (image-capable providers only;
     * currently gemini, per the registry image flag). Returns:
     *   { success, provider, model, image_base64, mime, latency_ms, error }
     */
    public static function generateImage(string $prompt, ?string $size = null, ?string $model = null, string $source = 'image'): array
    {
        $chain = self::candidates(null, 'image');
        $out = [
            'success' => false, 'provider' => '', 'model' => '',
            'image_base64' => null, 'mime' => null, 'latency_ms' => null, 'error' => null,
        ];
        if (empty($chain)) {
            $out['error'] = 'No image-capable AI provider available (configure a key / wait out cooldowns)';
            self::record('image', $source, $out);
            return $out;
        }

        foreach ($chain as $name) {
            $start = microtime(true);
            $res = self::imageOnce($name, $prompt, $model);
            $res['latency_ms'] = round((microtime(true) - $start) * 1000, 1);
            self::onResult($name, !empty($res['success']), $res['error'] ?? null);
            if (!empty($res['success'])) {
                AiRateLimiter::recordRequest($name);
                self::record('image', $source, $res);
                return $res;
            }
            $out = $res;
        }
        self::record('image', $source, $out);
        return $out;
    }

    private static function imageOnce(string $provider, string $prompt, ?string $model): array
    {
        $out = [
            'success' => false, 'provider' => $provider, 'model' => '',
            'image_base64' => null, 'mime' => null, 'latency_ms' => null, 'error' => null,
        ];

        $rate = AiRateLimiter::checkRateLimit($provider);
        if (!$rate['allowed']) {
            $out['error'] = $rate['message'];
            return $out;
        }

        $key = AiProviderRegistry::firstSecret($provider);
        // Only gemini generates images today (registry image_model is gemini's).
        if (AiProviderRegistry::client($provider) !== 'gemini') {
            $out['error'] = "Provider '{$provider}' has no image backend wired";
            return $out;
        }

        $useModel = $model ?: AiProviderRegistry::imageModel($provider);
        $out['model'] = $useModel;
        try {
            $url = AiProviderRegistry::baseUrl($provider) . '/models/' . rawurlencode($useModel) . ':generateContent?key=' . urlencode($key);
            $resp = Http::withHeaders(['Content-Type' => 'application/json'])->timeout(120)->post($url, [
                'contents' => [['parts' => [['text' => $prompt]]]],
                'generationConfig' => ['responseModalities' => ['TEXT', 'IMAGE']],
            ]);
            if ($resp->status() !== 200) {
                $out['error'] = 'HTTP ' . $resp->status() . ': ' . mb_substr($resp->body(), 0, 300);
                return $out;
            }
            foreach ($resp->json()['candidates'][0]['content']['parts'] ?? [] as $part) {
                if (isset($part['inlineData']['data'])) {
                    $out['image_base64'] = $part['inlineData']['data'];
                    $out['mime'] = $part['inlineData']['mimeType'] ?? 'image/png';
                    $out['success'] = true;
                    return $out;
                }
            }
            $out['error'] = 'No image returned by provider';
        } catch (\Throwable $e) {
            $out['error'] = $e->getMessage();
        }
        return $out;
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
                'configured' => $configured,
                // Best-effort: a configured provider not in cooldown is considered
                // available here; the per-card Test button runs the real probe.
                'available' => $configured && $cooldownS <= 0,
                'key_masked' => $configured ? AiProviderRegistry::maskKey(AiProviderRegistry::firstSecret($name)) : null,
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
