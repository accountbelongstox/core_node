<?php

namespace App\Services\AI;

use App\Utils\SecretStore;
use Illuminate\Support\Facades\Log;

/**
 * Multi-Key AI Client Base Class
 *
 * Provides common functionality for AI clients that support multiple API keys:
 * - Automatic key discovery (PROVIDER_KEY, PROVIDER_KEY_1, PROVIDER_KEY_2, ...)
 * - Key pooling and rotation
 * - Rate limit scaling based on number of keys
 * - Automatic failover when keys are rate limited
 */
abstract class MultiKeyAIClientBase
{
    protected UnifiedRateLimiter $rateLimiter;
    protected array $keyPool = [];
    protected array $baseRateLimits = [];
    protected string $providerName;

    /**
     * Initialize the multi-key client
     *
     * @param string $keyPrefix The prefix for secret keys (e.g., 'OPENROUTER_API_KEY', 'DEEPSEEK_API_KEY')
     * @param array $baseRateLimits Base rate limits per single key
     * @param string $providerName Provider name for logging (e.g., 'openrouter', 'deepseek')
     * @param string|null $apiKeyOverride Optional API key override
     */
    public function __construct(
        string $keyPrefix,
        array $baseRateLimits,
        string $providerName,
        ?string $apiKeyOverride = null
    ) {
        $this->rateLimiter = new UnifiedRateLimiter();
        $this->baseRateLimits = $baseRateLimits;
        $this->providerName = $providerName;

        $keys = $this->resolveApiKeys($keyPrefix, $apiKeyOverride);

        if (empty($keys)) {
            Log::warning("[{$providerName}] No API keys found for prefix: {$keyPrefix}");
            return;
        }

        foreach ($keys as $index => $keyValue) {
            $identifier = $this->buildKeyIdentifier($index, $keyValue);
            $this->keyPool[] = [
                'key' => $keyValue,
                'identifier' => $identifier,
                'index' => $index,
            ];
        }

        Log::info("[{$providerName}] Initialized with {$this->getKeyCount()} API key(s)", [
            'identifiers' => array_column($this->keyPool, 'identifier'),
            'effective_rate_limits' => $this->getEffectiveRateLimits(),
        ]);
    }

    /**
     * Resolve API keys from secret files
     *
     * Scans for keys in this order:
     * 1. Override key (if provided)
     * 2. PREFIX (without suffix)
     * 3. PREFIX_1, PREFIX_2, PREFIX_3, ... (up to 10)
     *
     * @param string $keyPrefix Key prefix (e.g., 'OPENROUTER_API_KEY')
     * @param string|null $override Optional override key
     * @return array Array of unique API keys
     */
    protected function resolveApiKeys(string $keyPrefix, ?string $override = null): array
    {
        $keys = [];
        $resolvedOverride = '';

        $resolvedOverride = is_string($override) ? trim($override) : '';
        if ($resolvedOverride !== '') {
            $keys[] = $resolvedOverride;
        }

        $keys = array_merge($keys, SecretStore::getAllIndexed($keyPrefix, 10));

        return array_values(array_unique($keys));
    }

    /**
     * Build key identifier for rate limiting
     */
    protected function buildKeyIdentifier(int $index, string $key): string
    {
        $hash = substr(md5($key), 0, 10);
        return 'key' . ($index + 1) . '_' . $hash;
    }

    /**
     * Check if client has at least one API key configured
     */
    public function hasApiKey(): bool
    {
        return !empty($this->keyPool);
    }

    /**
     * Get number of API keys configured
     */
    public function getKeyCount(): int
    {
        return count($this->keyPool);
    }

    /**
     * Get effective rate limits based on number of keys
     *
     * Rate limits are multiplied by the number of keys:
     * - 1 key:  base limits (e.g., 20 req/min)
     * - 2 keys: 2x base limits (e.g., 40 req/min)
     * - 3 keys: 3x base limits (e.g., 60 req/min)
     */
    public function getEffectiveRateLimits(): array
    {
        $keyCount = $this->getKeyCount();
        if ($keyCount === 0) {
            return $this->baseRateLimits;
        }

        $effectiveLimits = [];
        foreach ($this->baseRateLimits as $key => $value) {
            $effectiveLimits[$key] = $value * $keyCount;
        }

        return $effectiveLimits;
    }

    /**
     * Acquire an API key for use
     *
     * Rotates through available keys, skipping rate-limited ones.
     * Returns first available key or error if all keys are rate-limited.
     *
     * @param int $requests Number of requests (default: 1)
     * @param int $tokens Number of tokens (default: 0)
     * @param string|null $keyword Optional keyword for keyword-based rate limiting
     * @return array ['success' => bool, 'key' => string|null, 'identifier' => string|null, 'error' => string|null, ...]
     */
    protected function acquireApiKey(int $requests = 1, int $tokens = 0, ?string $keyword = null): array
    {
        if (empty($this->keyPool)) {
            return [
                'success' => false,
                'error' => "{$this->providerName} API key not configured",
            ];
        }

        $failures = [];

        foreach ($this->keyPool as $entry) {
            $result = $this->rateLimiter->acquire(
                $this->providerName,
                $entry['identifier'],
                $this->baseRateLimits, // Use base limits (per key)
                $requests,
                $tokens,
                $keyword
            );

            if ($result['allowed'] ?? false) {
                Log::debug("[{$this->providerName}] Acquired key: {$entry['identifier']}");
                return [
                    'success' => true,
                    'key' => $entry['key'],
                    'identifier' => $entry['identifier'],
                    'index' => $entry['index'],
                ];
            }

            $failures[] = [
                'identifier' => $entry['identifier'],
                'retry_after' => $result['retry_after'] ?? 60,
                'reason' => $result['reason'] ?? 'unknown',
            ];
        }

        // All keys are rate limited
        $retryAfter = 60;
        if (!empty($failures)) {
            $retryAfter = min(array_map(static function ($failure) {
                return $failure['retry_after'] ?? 60;
            }, $failures));
        }

        Log::warning("[{$this->providerName}] All API keys are rate limited", [
            'failures' => $failures,
            'retry_after' => $retryAfter,
        ]);

        return [
            'success' => false,
            'error' => 'Rate limit exceeded',
            'rate_limited' => true,
            'retry_after' => $retryAfter,
            'reason' => 'all_keys_rate_limited',
            'details' => $failures,
        ];
    }

    /**
     * Get usage statistics for all keys
     */
    public function getUsageStats(): array
    {
        if (empty($this->keyPool)) {
            return [];
        }

        $stats = [];

        foreach ($this->keyPool as $entry) {
            $usage = $this->rateLimiter->getUsage($this->providerName, $entry['identifier']);
            $stats[$entry['identifier']] = $usage;
        }

        // Calculate aggregate stats
        $aggregate = [
            'minute' => ['requests' => 0, 'tokens' => 0],
            'day' => ['requests' => 0, 'tokens' => 0],
        ];

        foreach ($stats as $usage) {
            if (isset($usage['minute'])) {
                $aggregate['minute']['requests'] += $usage['minute']['requests'] ?? 0;
                $aggregate['minute']['tokens'] += $usage['minute']['tokens'] ?? 0;
            }
            if (isset($usage['day'])) {
                $aggregate['day']['requests'] += $usage['day']['requests'] ?? 0;
                $aggregate['day']['tokens'] += $usage['day']['tokens'] ?? 0;
            }
        }

        return [
            'aggregate' => $aggregate,
            'per_key' => $stats,
            'key_count' => $this->getKeyCount(),
            'effective_limits' => $this->getEffectiveRateLimits(),
        ];
    }

    /**
     * Get provider information
     */
    public function getProviderInfo(): array
    {
        return [
            'provider' => $this->providerName,
            'key_count' => $this->getKeyCount(),
            'has_api_key' => $this->hasApiKey(),
            'base_rate_limits' => $this->baseRateLimits,
            'effective_rate_limits' => $this->getEffectiveRateLimits(),
            'rate_limit_multiplier' => $this->getKeyCount(),
        ];
    }
}
