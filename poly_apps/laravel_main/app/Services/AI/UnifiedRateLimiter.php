<?php

namespace App\Services\AI;

use App\Providers\PathMapper;
use Illuminate\Support\Facades\Log;

/**
 * Unified Rate Limiter for all AI providers
 *
 * Tracks usage by provider, key, and keyword for intelligent rate limiting.
 * Uses JSON file-based storage with file locking for concurrency safety.
 */
class UnifiedRateLimiter
{
    private string $cacheDir;

    public function __construct()
    {
        $this->cacheDir = rtrim(PathMapper::getCachePath(), '/') . '/ai_rate_limits';
        PathMapper::ensureDirectoryExists($this->cacheDir);
    }

    /**
     * Check if request is allowed and reserve usage
     */
    public function acquire(
        string $provider,
        string $keyIdentifier,
        array $limits,
        int $requests = 1,
        int $tokens = 0,
        ?string $keyword = null
    ): array {
        $path = $this->buildLimitPath($provider, $keyIdentifier);
        $handle = @fopen($path, 'c+');

        if (!$handle) {
            Log::warning('[UnifiedRateLimiter] Unable to open cache file', [
                'provider' => $provider,
                'path' => $path
            ]);
            return ['allowed' => true, 'reason' => 'cache_unavailable'];
        }

        if (!flock($handle, LOCK_EX)) {
            fclose($handle);
            return ['allowed' => true, 'reason' => 'lock_failed'];
        }

        try {
            rewind($handle);
            $contents = stream_get_contents($handle);
            $state = $contents ? json_decode($contents, true) : null;

            if (!is_array($state)) {
                $state = $this->defaultState();
            }

            $now = time();
            $currentDate = date('Y-m-d', $now);

            $state['minute'] = $this->initializeWindow(
                $state['minute'] ?? [],
                $now,
                60
            );

            $state['day'] = $this->initializeDayWindow(
                $state['day'] ?? [],
                $currentDate
            );

            if ($keyword) {
                $state['keywords'] = $state['keywords'] ?? [];
                $state['keywords'][$keyword] = $this->initializeWindow(
                    $state['keywords'][$keyword] ?? [],
                    $now,
                    60
                );
            }

            $checkResult = $this->checkLimits(
                $state,
                $limits,
                $requests,
                $tokens,
                $keyword,
                $now
            );

            if (!$checkResult['allowed']) {
                return $checkResult;
            }

            $this->incrementUsage($state, $requests, $tokens, $keyword);

            rewind($handle);
            ftruncate($handle, 0);
            fwrite($handle, json_encode($state, JSON_PRETTY_PRINT));

            return [
                'allowed' => true,
                'provider' => $provider,
                'key_identifier' => $keyIdentifier,
                'keyword' => $keyword,
            ];
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    /**
     * Get current usage statistics
     */
    public function getUsage(string $provider, string $keyIdentifier): array
    {
        $path = $this->buildLimitPath($provider, $keyIdentifier);

        if (!file_exists($path)) {
            return $this->defaultState();
        }

        $contents = file_get_contents($path);
        $state = $contents ? json_decode($contents, true) : null;

        return is_array($state) ? $state : $this->defaultState();
    }

    /**
     * Reset usage for specific provider/key
     */
    public function reset(string $provider, string $keyIdentifier): bool
    {
        $path = $this->buildLimitPath($provider, $keyIdentifier);

        if (file_exists($path)) {
            return unlink($path);
        }

        return true;
    }

    /**
     * Get all usage across all providers
     */
    public function getAllUsage(): array
    {
        $usage = [];
        $files = glob($this->cacheDir . '/rate_*.json');

        foreach ($files as $file) {
            $basename = basename($file, '.json');
            $parts = explode('_', $basename, 3);

            if (count($parts) >= 3) {
                $provider = $parts[1];
                $keyId = $parts[2];

                $contents = file_get_contents($file);
                $state = $contents ? json_decode($contents, true) : null;

                if (is_array($state)) {
                    $usage[$provider][$keyId] = $state;
                }
            }
        }

        return $usage;
    }

    private function buildLimitPath(string $provider, string $keyIdentifier): string
    {
        return rtrim($this->cacheDir, '/') . '/rate_' . $provider . '_' . $keyIdentifier . '.json';
    }

    private function defaultState(): array
    {
        return [
            'minute' => [
                'start' => time(),
                'requests' => 0,
                'tokens' => 0,
            ],
            'day' => [
                'date' => date('Y-m-d'),
                'requests' => 0,
                'tokens' => 0,
            ],
            'keywords' => [],
        ];
    }

    private function initializeWindow(array $window, int $now, int $duration): array
    {
        $window = array_merge([
            'start' => $now,
            'requests' => 0,
            'tokens' => 0,
        ], $window);

        if ($now - $window['start'] >= $duration) {
            return [
                'start' => $now,
                'requests' => 0,
                'tokens' => 0,
            ];
        }

        return $window;
    }

    private function initializeDayWindow(array $window, string $currentDate): array
    {
        $window = array_merge([
            'date' => $currentDate,
            'requests' => 0,
            'tokens' => 0,
        ], $window);

        if ($window['date'] !== $currentDate) {
            return [
                'date' => $currentDate,
                'requests' => 0,
                'tokens' => 0,
            ];
        }

        return $window;
    }

    private function checkLimits(
        array $state,
        array $limits,
        int $requests,
        int $tokens,
        ?string $keyword,
        int $now
    ): array {
        if (isset($limits['rpm']) && $state['minute']['requests'] + $requests > $limits['rpm']) {
            $retry = max(1, ($state['minute']['start'] + 60) - $now);
            return [
                'allowed' => false,
                'retry_after' => $retry,
                'reason' => 'minute_requests_exceeded',
                'limit' => $limits['rpm'],
                'current' => $state['minute']['requests'],
            ];
        }

        if (isset($limits['tpm']) && $state['minute']['tokens'] + $tokens > $limits['tpm']) {
            $retry = max(1, ($state['minute']['start'] + 60) - $now);
            return [
                'allowed' => false,
                'retry_after' => $retry,
                'reason' => 'minute_tokens_exceeded',
                'limit' => $limits['tpm'],
                'current' => $state['minute']['tokens'],
            ];
        }

        if (isset($limits['rpd']) && $state['day']['requests'] + $requests > $limits['rpd']) {
            $retry = max(1, strtotime('tomorrow', $now) - $now);
            return [
                'allowed' => false,
                'retry_after' => $retry,
                'reason' => 'day_requests_exceeded',
                'limit' => $limits['rpd'],
                'current' => $state['day']['requests'],
            ];
        }

        if (isset($limits['tpd']) && $state['day']['tokens'] + $tokens > $limits['tpd']) {
            $retry = max(1, strtotime('tomorrow', $now) - $now);
            return [
                'allowed' => false,
                'retry_after' => $retry,
                'reason' => 'day_tokens_exceeded',
                'limit' => $limits['tpd'],
                'current' => $state['day']['tokens'],
            ];
        }

        if ($keyword && isset($limits['keyword_rpm'])) {
            $kwWindow = $state['keywords'][$keyword] ?? ['requests' => 0];
            if ($kwWindow['requests'] + $requests > $limits['keyword_rpm']) {
                $retry = max(1, ($kwWindow['start'] + 60) - $now);
                return [
                    'allowed' => false,
                    'retry_after' => $retry,
                    'reason' => 'keyword_rate_exceeded',
                    'keyword' => $keyword,
                    'limit' => $limits['keyword_rpm'],
                    'current' => $kwWindow['requests'],
                ];
            }
        }

        return ['allowed' => true];
    }

    private function incrementUsage(array &$state, int $requests, int $tokens, ?string $keyword): void
    {
        $state['minute']['requests'] += $requests;
        $state['minute']['tokens'] += $tokens;
        $state['day']['requests'] += $requests;
        $state['day']['tokens'] += $tokens;

        if ($keyword) {
            if (!isset($state['keywords'][$keyword])) {
                $state['keywords'][$keyword] = [
                    'start' => time(),
                    'requests' => 0,
                    'tokens' => 0,
                ];
            }
            $state['keywords'][$keyword]['requests'] += $requests;
            $state['keywords'][$keyword]['tokens'] += $tokens;
        }
    }
}
