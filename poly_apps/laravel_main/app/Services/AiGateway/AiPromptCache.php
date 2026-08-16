<?php

namespace App\Services\AiGateway;

use App\Providers\PathMapper;

/**
 * Gateway prompt cache — deterministic prompt → response memoization for the
 * AI chat surface.
 *
 * A cache key covers the full effective request shape (requested provider,
 * model, conversation, message text and attachment hashes), so a repeated
 * prompt is answered without spending provider quota. Anthropic additionally
 * gets PROVIDER-SIDE prompt caching through the agent's cache_control option;
 * this store is the gateway-local layer that works for every provider.
 *
 * The store is one JSON document under the Laravel data dir (resolved via
 * PathMapper, never raw storage_path()), written with the same tmp + atomic
 * rename under an flock'd lock file the other gateway stores use:
 *
 *   { version, totals: {hits, misses},
 *     providers: { <requestedProvider>: {hits, misses} },
 *     entries: [ { key, provider, resolved_provider, model, prompt, text,
 *                  usage, ts, expires_at, hits }, ... ] }   // oldest first
 */
class AiPromptCache
{
    private const MAX_ENTRIES = 100;
    private const TTL_S = 21600;              // 6 h
    private const TEXT_MAX = 65536;           // bound one cached response body
    private const PROMPT_EXCERPT_MAX = 300;   // excerpt kept for the UI listing

    public static function file(): string
    {
        return PathMapper::getLaravelDataDir('ai_prompt_cache.json');
    }

    public static function ttl(): int
    {
        return self::TTL_S;
    }

    /**
     * Stable cache key over the full effective request shape.
     *
     * @param string[] $imageHashes sha256 of each attachment's bytes
     */
    public static function makeKey(string $provider, ?string $model, string $conversationKey, string $message, array $imageHashes): string
    {
        sort($imageHashes);
        return hash('sha256', implode('|', [
            'v1',
            strtolower($provider),
            (string) $model,
            $conversationKey,
            $message,
            implode(',', $imageHashes),
        ]));
    }

    /**
     * Look up one entry. A live hit increments the hit counters (and the
     * entry's own hit count); an expired or missing lookup counts a miss.
     * Returns the entry (with text + usage) or null.
     */
    public static function lookup(string $key, string $provider): ?array
    {
        $hit = null;

        self::withLock(static function () use ($key, $provider, &$hit): void {
            $doc = self::load();
            $now = time();
            $kept = [];

            foreach ($doc['entries'] as $entry) {
                if (($entry['expires_at'] ?? 0) <= $now) {
                    continue; // prune expired
                }
                if ($entry['key'] === $key && $hit === null) {
                    $entry['hits'] = (int) ($entry['hits'] ?? 0) + 1;
                    $hit = $entry;
                    continue; // re-appended at the end below (LRU refresh)
                }
                $kept[] = $entry;
            }

            if ($hit !== null) {
                $kept[] = $hit;
                $doc['totals']['hits']++;
                $doc['providers'][$provider]['hits'] = ($doc['providers'][$provider]['hits'] ?? 0) + 1;
            } else {
                $doc['totals']['misses']++;
                $doc['providers'][$provider]['misses'] = ($doc['providers'][$provider]['misses'] ?? 0) + 1;
            }

            $doc['entries'] = $kept;
            self::save($doc);
        });

        return $hit;
    }

    /**
     * Store one response under its key (replacing any older entry with the
     * same key). Oversized bodies are skipped rather than truncated.
     */
    public static function store(string $key, string $requestedProvider, string $resolvedProvider, string $model, string $prompt, string $text, array $usage): void
    {
        if ($text === '' || mb_strlen($text) > self::TEXT_MAX) {
            return;
        }

        self::withLock(static function () use ($key, $requestedProvider, $resolvedProvider, $model, $prompt, $text, $usage): void {
            $doc = self::load();
            $now = time();

            $entries = array_values(array_filter(
                $doc['entries'],
                static fn (array $entry): bool => $entry['key'] !== $key && ($entry['expires_at'] ?? 0) > $now
            ));

            $entries[] = [
                'key' => $key,
                'provider' => $requestedProvider,
                'resolved_provider' => $resolvedProvider,
                'model' => $model,
                'prompt' => mb_substr($prompt, 0, self::PROMPT_EXCERPT_MAX),
                'text' => $text,
                'usage' => $usage,
                'ts' => $now,
                'expires_at' => $now + self::TTL_S,
                'hits' => 0,
            ];

            if (count($entries) > self::MAX_ENTRIES) {
                $entries = array_slice($entries, -self::MAX_ENTRIES);
            }

            $doc['entries'] = $entries;
            self::save($doc);
        });
    }

    /**
     * Snapshot for the UI: totals, per-provider counters and the most recent
     * entries (excerpts only — never the cached bodies).
     */
    public static function stats(): array
    {
        $doc = self::load();
        $now = time();

        $live = array_values(array_filter(
            $doc['entries'],
            static fn (array $entry): bool => ($entry['expires_at'] ?? 0) > $now
        ));

        $perProvider = $doc['providers'];
        foreach ($live as $entry) {
            $name = (string) ($entry['provider'] ?? '');
            if ($name === '') {
                continue;
            }
            $perProvider[$name]['entries'] = ($perProvider[$name]['entries'] ?? 0) + 1;
        }

        $hits = (int) ($doc['totals']['hits'] ?? 0);
        $misses = (int) ($doc['totals']['misses'] ?? 0);
        $total = $hits + $misses;

        $recent = array_map(static function (array $entry): array {
            unset($entry['text']);
            return $entry;
        }, array_slice(array_reverse($live), 0, 20));

        return [
            'success' => true,
            'ttl_s' => self::TTL_S,
            'entries' => count($live),
            'hits' => $hits,
            'misses' => $misses,
            'hit_rate' => $total > 0 ? round($hits / $total, 4) : null,
            'per_provider' => $perProvider,
            'recent' => $recent,
        ];
    }

    /** Drop every entry and reset the counters. */
    public static function clear(): array
    {
        self::withLock(static function (): void {
            self::save(self::blank());
        });

        return ['success' => true];
    }

    // --- storage ----------------------------------------------------------- //

    private static function blank(): array
    {
        return [
            'version' => 1,
            'totals' => ['hits' => 0, 'misses' => 0],
            'providers' => [],
            'entries' => [],
        ];
    }

    private static function load(): array
    {
        $path = self::file();
        if (is_file($path)) {
            $raw = @file_get_contents($path);
            if (is_string($raw) && $raw !== '') {
                $decoded = json_decode($raw, true);
                if (is_array($decoded)) {
                    return [
                        'version' => 1,
                        'totals' => [
                            'hits' => (int) ($decoded['totals']['hits'] ?? 0),
                            'misses' => (int) ($decoded['totals']['misses'] ?? 0),
                        ],
                        'providers' => is_array($decoded['providers'] ?? null) ? $decoded['providers'] : [],
                        'entries' => is_array($decoded['entries'] ?? null) ? $decoded['entries'] : [],
                    ];
                }
            }
        }
        return self::blank();
    }

    private static function save(array $doc): void
    {
        $path = self::file();
        $dir = dirname($path);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $tmp = $path . '.tmp.' . getmypid();
        if (@file_put_contents($tmp, json_encode($doc, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) !== false) {
            @rename($tmp, $path);
        }
    }

    /** Serialize read-modify-write across Octane workers via an flock'd lock file. */
    private static function withLock(callable $callback): void
    {
        $path = self::file();
        $dir = dirname($path);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $handle = @fopen($path . '.lock', 'c');
        if ($handle === false) {
            $callback();
            return;
        }
        try {
            flock($handle, LOCK_EX);
            $callback();
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }
}
