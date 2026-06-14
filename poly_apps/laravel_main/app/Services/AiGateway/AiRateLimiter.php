<?php

namespace App\Services\AiGateway;

use App\Providers\PathMapper;

/**
 * Local AI rate-limit enforcement — the PHP port of pycore's
 * pyctl.ai.ai_rate_limits, sharing the SAME on-disk usage store.
 *
 * pycore (Windows host) and Laravel (WSL) must see ONE set of counters so a
 * shared provider key never gets double its real free-tier budget. The only
 * filesystem path both resolve to a single physical file is the core_node repo
 * root (D:\..\core_node on Windows == /mnt/d/..\core_node in WSL via DrvFs), so
 * the store lives at <core_node>/.ai_state/ai_rate_usage.json — written by
 * pycore's ai_rate_limits and read/written here with identical schema:
 *
 *   { "saved_at": float,
 *     "providers": { "<name>": { "minute": [ts,...],
 *                                "day":   { "YYYY-MM-DD": count },
 *                                "month": { "YYYY-MM":    count } } } }
 *
 * RPM is a sliding 60s window; RPD/monthly are calendar buckets that reset at
 * LOCAL midnight / on the 1st (matches pycore). Writes go through a tmp file +
 * atomic rename and an flock'd lock file so concurrent Octane workers (and the
 * pycore atomic replace) never corrupt the document.
 */
class AiRateLimiter
{
    /** Mirror of pycore RATE_LIMITS_LAST_UPDATED. */
    public const LAST_UPDATED = '2026-06-13';

    /**
     * provider -> limits; null = no local enforcement (paid / balance-only).
     * Optional 'models' map overrides by exact model id. Mirrors pycore exactly.
     *
     * @var array<string, array<string, mixed>|null>
     */
    private const PROVIDER_LIMITS = [
        'github' => ['rpm' => 15, 'rpd' => 150, 'note' => 'GitHub Models low tier (Copilot Free)'],
        'openrouter' => ['rpm' => 20, 'rpd' => 50, 'note' => 'OpenRouter :free with <$10 lifetime credits'],
        'gemini' => ['rpm' => 5, 'rpd' => 20, 'note' => 'Gemini 2.5 Flash free tier (conservative)'],
        'groq' => [
            'rpm' => 30, 'rpd' => 1000,
            'models' => [
                'llama-3.3-70b-versatile' => ['rpm' => 30, 'rpd' => 1000],
                'llama-3.1-8b-instant' => ['rpm' => 30, 'rpd' => 14400],
            ],
            'note' => 'Groq free tier per model',
        ],
        'cerebras' => ['rpm' => 30, 'rpd' => 1440, 'note' => 'Cerebras free tier (approx daily cap from TPD docs)'],
        'mistral' => ['rps' => 1.0, 'note' => 'Mistral experiment plan 1 req/s'],
        'cohere' => ['rpm' => 20, 'rpm_month' => 1000, 'note' => 'Cohere trial 20/min, 1000/month'],
        'nvidia' => ['rpm' => 40, 'note' => 'NVIDIA NIM free tier'],
        'huggingface' => ['rpm' => 10, 'note' => 'HF serverless credits — conservative local guard'],
        'zhipuai' => ['rpm' => 20, 'note' => 'Zhipu free tier (conservative; no public quota API)'],
        'cloudflare' => ['rpm' => 30, 'rpd' => 500, 'note' => 'Workers AI daily allocation (conservative)'],
        'siliconflow' => ['rpm' => 20, 'note' => 'SiliconFlow free-model RPM'],
        'dashscope' => ['rpm' => 10, 'rpd' => 100, 'note' => 'DashScope qwen-turbo free tier'],
        'hunyuan' => ['rpm' => 20, 'note' => 'Hunyuan lite free tier'],
        'qianfan' => ['rpm' => 20, 'note' => 'Qianfan ERNIE speed/lite free tier'],
        'spark' => ['rpm' => 20, 'note' => 'Spark Lite free tier'],
        // balance / paid — enforced only via gateway cooldown on 429, not local RPM
        'deepseek' => null,
        'openai' => null,
        'anthropic' => null,
        'volcano' => null,
        'moonshot' => null,
        'minimax' => null,
        'stepfun' => null,
        'yi' => null,
        'xai' => null,
        'together' => null,
    ];

    /**
     * Absolute path of the shared usage store (same file pycore writes).
     */
    public static function usageFile(): string
    {
        $coreNode = PathMapper::getCoreNodeDir() ?: PathMapper::getLaravelMainDir();
        return rtrim($coreNode, '/\\') . '/.ai_state/ai_rate_usage.json';
    }

    /** Conservative fallback RPM for a registry free provider with no explicit row. */
    private const FREE_DEFAULT_RPM = 10;

    /**
     * Resolve the applicable limit spec for a provider (+ optional model override).
     * Returns null when the provider has no local enforcement.
     *
     * Extensibility: a provider NOT listed in PROVIDER_LIMITS but marked
     * tier=free in the registry still gets a conservative default guard, so
     * adding a free provider needs only the registry entry — it can never land
     * "unlimited" by omission. Balance/paid (and explicit null rows) stay
     * unenforced (cooldown-on-429 handles those).
     */
    public static function resolveLimit(string $provider, ?string $model = null): ?array
    {
        $listed = array_key_exists($provider, self::PROVIDER_LIMITS);
        $raw = $listed ? self::PROVIDER_LIMITS[$provider] : null;
        if ($raw === null) {
            if (!$listed && AiProviderRegistry::tier($provider) === 'free') {
                $raw = ['rpm' => self::FREE_DEFAULT_RPM, 'note' => 'Conservative default (unlisted free provider)'];
            } else {
                return null;
            }
        }
        $models = $raw['models'] ?? [];
        unset($raw['models']);
        if ($model !== null && isset($models[$model]) && is_array($models[$model])) {
            $raw = array_merge($raw, $models[$model]);
        }
        return [
            'rpm' => $raw['rpm'] ?? null,
            'rpd' => $raw['rpd'] ?? null,
            'rps' => $raw['rps'] ?? null,
            'rpm_month' => $raw['rpm_month'] ?? null,
            'note' => $raw['note'] ?? '',
        ];
    }

    /**
     * Check whether a request is allowed under the local counters.
     *
     * @return array{allowed: bool, message: string, retry_after_s: float, limits: array|null}
     */
    public static function checkRateLimit(string $provider, ?string $model = null): array
    {
        $spec = self::resolveLimit($provider, $model);
        if ($spec === null) {
            return ['allowed' => true, 'message' => '', 'retry_after_s' => 0.0, 'limits' => null];
        }

        $now = microtime(true);
        $result = self::withLock(static function () use ($provider, $spec, $now) {
            $data = self::load();
            $bucket = $data['providers'][$provider] ?? ['minute' => [], 'day' => [], 'month' => []];
            $minute = self::pruneTimestamps((array) ($bucket['minute'] ?? []), 60.0, $now);
            $dayCount = (int) (self::coerceDayMap($bucket['day'] ?? [])[self::dayKey($now)] ?? 0);
            $monthCount = (int) (self::asCountMap($bucket['month'] ?? [])[self::monthKey($now)] ?? 0);

            if (!empty($spec['rps']) && $spec['rps'] > 0) {
                $minGap = 1.0 / $spec['rps'];
                $last = !empty($minute) ? end($minute) : 0.0;
                if ($last && ($now - $last) < $minGap) {
                    $wait = $minGap - ($now - $last);
                    return self::deny(
                        sprintf('Rate limit (%s): max %s req/s (docs updated %s). Retry in %ds.',
                            $provider, $spec['rps'], self::LAST_UPDATED, (int) round($wait)),
                        round($wait, 1), $spec);
                }
            }

            if ($spec['rpm'] !== null && count($minute) >= $spec['rpm']) {
                $wait = !empty($minute) ? 60.0 - ($now - $minute[0]) : 60.0;
                return self::deny(
                    sprintf('Rate limit (%s): %d requests/minute exceeded. Retry in %ds.',
                        $provider, $spec['rpm'], (int) round(max($wait, 1))),
                    round(max($wait, 1), 1), $spec);
            }

            if ($spec['rpd'] !== null && $dayCount >= $spec['rpd']) {
                $wait = self::secondsToNextUtcMidnight($now);
                return self::deny(
                    sprintf('Rate limit (%s): %d requests/day exceeded. Resets at UTC midnight (in %ds).',
                        $provider, $spec['rpd'], (int) round(max($wait, 1))),
                    round(max($wait, 1), 1), $spec);
            }

            if ($spec['rpm_month'] !== null && $monthCount >= $spec['rpm_month']) {
                $wait = self::secondsToNextUtcMonth($now);
                return self::deny(
                    sprintf('Rate limit (%s): %d requests/month exceeded (resets on the 1st, in %ds).',
                        $provider, $spec['rpm_month'], (int) round(max($wait, 60))),
                    round(max($wait, 60), 1), $spec);
            }

            return ['allowed' => true, 'message' => '', 'retry_after_s' => 0.0, 'limits' => $spec];
        });

        return $result;
    }

    /**
     * Record one successful request for the local rate counters (shared store).
     */
    public static function recordRequest(string $provider): void
    {
        if (self::resolveLimit($provider) === null) {
            return;
        }
        $now = microtime(true);
        self::withLock(static function () use ($provider, $now) {
            $data = self::load();
            $bucket = $data['providers'][$provider] ?? ['minute' => [], 'day' => [], 'month' => []];

            $minute = self::pruneTimestamps((array) ($bucket['minute'] ?? []), 60.0, $now);
            $minute[] = $now;
            $bucket['minute'] = $minute;

            // Calendar-day counter: keep only today (past days drop at midnight).
            $dayMap = self::coerceDayMap($bucket['day'] ?? []);
            $dk = self::dayKey($now);
            $dayMap[$dk] = (int) ($dayMap[$dk] ?? 0) + 1;
            $bucket['day'] = [$dk => $dayMap[$dk]];

            // Calendar-month counter: keep only this month.
            $monthMap = self::asCountMap($bucket['month'] ?? []);
            $mk = self::monthKey($now);
            $monthMap[$mk] = (int) ($monthMap[$mk] ?? 0) + 1;
            $bucket['month'] = [$mk => $monthMap[$mk]];

            $data['providers'][$provider] = $bucket;
            self::save($data);
            return null;
        });
    }

    /**
     * Current local usage vs encoded limits (for the UI). Mirrors rate_status().
     *
     * @return array<string, mixed>
     */
    public static function rateStatus(?string $provider = null): array
    {
        $now = microtime(true);
        $data = self::load();

        $one = static function (string $name) use ($data, $now): array {
            $spec = self::resolveLimit($name);
            if ($spec === null) {
                return ['provider' => $name, 'enforced' => false, 'note' => 'No local RPM/RPD (balance or paid)'];
            }
            $bucket = $data['providers'][$name] ?? [];
            $minute = self::pruneTimestamps((array) ($bucket['minute'] ?? []), 60.0, $now);
            $dayCount = (int) (self::coerceDayMap($bucket['day'] ?? [])[self::dayKey($now)] ?? 0);
            $monthCount = (int) (self::asCountMap($bucket['month'] ?? [])[self::monthKey($now)] ?? 0);
            return [
                'provider' => $name,
                'enforced' => true,
                'limits' => [
                    'rpm' => $spec['rpm'],
                    'rpd' => $spec['rpd'],
                    'rps' => $spec['rps'],
                    'rpm_month' => $spec['rpm_month'],
                    'note' => $spec['note'],
                ],
                'usage' => [
                    'minute' => count($minute),
                    'day' => $dayCount,
                    'month' => $monthCount,
                ],
                'resets_in' => [
                    'minute' => self::resetsIn($minute, 60.0, $now),
                    'day' => ($spec['rpd'] !== null && $dayCount > 0) ? round(self::secondsToNextUtcMidnight($now), 1) : null,
                    'month' => ($spec['rpm_month'] !== null && $monthCount > 0) ? round(self::secondsToNextUtcMonth($now), 1) : null,
                ],
                'last_updated' => self::LAST_UPDATED,
            ];
        };

        if ($provider !== null && $provider !== '') {
            return ['success' => true, 'status' => $one(strtolower(trim($provider)))];
        }

        // Every enforced provider, in the canonical display order — covers the
        // explicit PROVIDER_LIMITS rows AND any registry free provider picked up
        // by resolveLimit's fallback, so new providers appear in the UI meters.
        $providers = [];
        foreach (AiProviderRegistry::orderedNames() as $name) {
            if (self::resolveLimit($name) !== null) {
                $providers[] = $one($name);
            }
        }
        return [
            'success' => true,
            'last_updated' => self::LAST_UPDATED,
            'storage_path' => self::usageFile(),
            'providers' => $providers,
        ];
    }

    // --- internals --------------------------------------------------------- //

    private static function deny(string $message, float $retryAfter, array $spec): array
    {
        return ['allowed' => false, 'message' => $message, 'retry_after_s' => $retryAfter, 'limits' => $spec];
    }

    /** @return array{providers: array<string, mixed>} */
    private static function load(): array
    {
        $path = self::usageFile();
        if (is_file($path)) {
            $raw = @file_get_contents($path);
            if ($raw !== false && $raw !== '') {
                $decoded = json_decode($raw, true);
                if (is_array($decoded)) {
                    if (!isset($decoded['providers']) || !is_array($decoded['providers'])) {
                        $decoded['providers'] = [];
                    }
                    return $decoded;
                }
            }
        }
        return ['providers' => []];
    }

    private static function save(array $data): void
    {
        $path = self::usageFile();
        $dir = dirname($path);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $data['saved_at'] = microtime(true);
        $tmp = $path . '.tmp.' . getmypid();
        if (@file_put_contents($tmp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) !== false) {
            @rename($tmp, $path);
        }
    }

    /**
     * Serialize a read-modify-write across Octane workers with an flock'd lock
     * file. Cross-runtime (vs pycore) safety still rests on the atomic rename in
     * save(); free-tier requests are seconds apart so lost updates are negligible.
     *
     * @template T
     * @param  callable():T  $fn
     * @return T
     */
    private static function withLock(callable $fn)
    {
        $path = self::usageFile();
        $dir = dirname($path);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $lockPath = $path . '.lock';
        $handle = @fopen($lockPath, 'c');
        if ($handle === false) {
            return $fn();
        }
        $locked = @flock($handle, LOCK_EX);
        try {
            return $fn();
        } finally {
            if ($locked) {
                @flock($handle, LOCK_UN);
            }
            @fclose($handle);
        }
    }

    private static function pruneTimestamps(array $entries, float $windowS, float $now): array
    {
        $cutoff = $now - $windowS;
        $out = [];
        foreach ($entries as $t) {
            if (is_numeric($t) && (float) $t >= $cutoff) {
                $out[] = (float) $t;
            }
        }
        return array_values($out);
    }

    /** Coerce the day field to {YYYY-MM-DD: count}, migrating an old ts-list. */
    private static function coerceDayMap($value): array
    {
        if (is_array($value)) {
            // A list of timestamps (legacy rolling-window format) is numerically keyed.
            $isList = $value === [] || array_keys($value) === range(0, count($value) - 1);
            if ($isList) {
                $out = [];
                foreach ($value as $t) {
                    if (is_numeric($t)) {
                        $k = self::dayKey((float) $t);
                        $out[$k] = (int) ($out[$k] ?? 0) + 1;
                    }
                }
                return $out;
            }
            return $value;
        }
        return [];
    }

    private static function asCountMap($value): array
    {
        return is_array($value) ? $value : [];
    }

    // Bucket keys are computed in UTC so they are identical to pycore's
    // (datetime ... timezone.utc) regardless of this process's configured tz
    // (Laravel pins app.timezone to UTC, pycore runs in Windows local time) —
    // see the store-sharing note at the top of the class. gmdate() and
    // DateTimeImmutable('@ts') both ignore the default tz and use UTC.
    private static function dayKey(float $ts): string
    {
        return gmdate('Y-m-d', (int) $ts);
    }

    private static function monthKey(float $ts): string
    {
        return gmdate('Y-m', (int) $ts);
    }

    private static function secondsToNextUtcMidnight(float $now): float
    {
        $next = (new \DateTimeImmutable('@' . (int) $now))->setTime(0, 0, 0)->modify('+1 day');
        return max(0.0, $next->getTimestamp() - $now);
    }

    private static function secondsToNextUtcMonth(float $now): float
    {
        $next = (new \DateTimeImmutable('@' . (int) $now))->modify('first day of next month')->setTime(0, 0, 0);
        return max(0.0, $next->getTimestamp() - $now);
    }

    private static function resetsIn(array $entries, float $windowS, float $now): ?float
    {
        if (empty($entries)) {
            return null;
        }
        $oldest = min($entries);
        return round(max(0.0, $windowS - ($now - $oldest)), 1);
    }
}
