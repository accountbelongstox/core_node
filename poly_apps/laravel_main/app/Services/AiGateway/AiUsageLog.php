<?php

namespace App\Services\AiGateway;

use App\Providers\PathMapper;

/**
 * Shared AI *usage* log — the text/vision/probe sibling of AiImageHistory
 * (images live there with their bytes; this records everything else an AI call
 * does). The PHP twin of pycore's pyctl.ai.ai_usage_log, sharing the SAME file.
 *
 * pycore (Windows) and Laravel (WSL) append to ONE file under
 * <core_node>/.ai_state — the only path both resolve to a single physical file
 * (DrvFs), the same channel .secret_keys / ai_rate_usage.json / ai_image_history
 * already use — so the usage history is identical on both ends and both UIs.
 *
 *   <core_node>/.ai_state/ai_usage_records.json   newest-last ring buffer + stats
 *
 * Record: { ts, iso, runtime:'pycore'|'laravel', kind:'text'|'vision'|'probe',
 *           provider, model, source, success, latency_ms, error }
 * Stats : { "<provider>": { "<kind>":{calls,ok,failed}, last_ts, last_model } }
 *
 * Write safety mirrors AiImageHistory / AiRateLimiter: tmp file + atomic rename,
 * serialized by an flock'd lock file. RUNTIME tags rows this side wrote.
 */
class AiUsageLog
{
    public const RUNTIME = 'laravel';

    /** Newest-last ring buffer cap (matches pycore _MAX_ENTRIES). */
    private const MAX_ENTRIES = 400;

    private const KINDS = ['text', 'vision', 'probe'];

    /** Absolute path of the shared .data/.ai_state dir (same dir pycore writes). */
    public static function stateDir(): string
    {
        $coreNode = PathMapper::getCoreNodeDir() ?: PathMapper::getLaravelMainDir();
        $new = rtrim($coreNode, '/\\') . '/.data/.ai_state';
        self::migrateLegacyStateDir($coreNode, $new);
        return $new;
    }

    /** Run the legacy-dir migration at most once per worker. */
    private static bool $migrated = false;

    /**
     * One-time PER-FILE move of the prior <core_node>/.ai_state dir into
     * .data/.ai_state (per-file so a partially-created new dir never orphans files).
     */
    private static function migrateLegacyStateDir(string $coreNode, string $new): void
    {
        if (self::$migrated) {
            return;
        }
        self::$migrated = true;
        $old = rtrim($coreNode, '/\\') . '/.ai_state';
        if (!is_dir($old) || @realpath($old) === @realpath($new)) {
            return;
        }
        if (!is_dir($new)) {
            @mkdir($new, 0775, true);
        }
        foreach ((array) @scandir($old) as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }
            $dest = $new . '/' . $item;
            if (!file_exists($dest)) {
                @rename($old . '/' . $item, $dest);
            }
        }
        @rmdir($old);
    }

    public static function file(): string
    {
        return self::stateDir() . '/ai_usage_records.json';
    }

    /**
     * Append one usage record (text / vision / probe). Best-effort: any failure
     * is swallowed — recording usage must never break the actual AI call. Image
     * generations are NOT recorded here (they live in AiImageHistory).
     */
    public static function record(
        string $kind,
        string $provider,
        string $model = '',
        bool $success = false,
        ?float $latencyMs = null,
        string $source = '',
        ?string $error = null,
        string $runtime = self::RUNTIME
    ): void {
        $kind = strtolower(trim($kind));
        if (!in_array($kind, self::KINDS, true)) {
            $kind = 'text';
        }
        $provider = trim($provider);
        $ts = microtime(true);
        $entry = [
            'ts' => $ts,
            'iso' => gmdate('Y-m-d\TH:i:s+00:00', (int) $ts),
            'runtime' => $runtime !== '' ? $runtime : self::RUNTIME,
            'kind' => $kind,
            'provider' => $provider,
            'model' => $model,
            'source' => $source,
            'success' => $success,
            'latency_ms' => $latencyMs,
            'error' => $error,
        ];

        // Mirror to the human-readable TEXT log (best-effort; covers every text /
        // vision / probe AI call since they all funnel through here). Shares ONE
        // ai_calls.log with pycore + AiImageHistory.
        AiTextLog::log(
            $entry['runtime'], $kind, $provider, $model,
            $source, $success, $latencyMs, $error
        );

        self::withLock(static function () use ($entry, $kind, $provider, $ts): void {
            $doc = self::load();
            $doc['entries'][] = $entry;
            $count = count($doc['entries']);
            if ($count > self::MAX_ENTRIES) {
                $doc['entries'] = array_values(array_slice($doc['entries'], $count - self::MAX_ENTRIES));
            }
            // Per-provider/kind rollup so the UI can show "gemini text 18/2".
            if (!isset($doc['stats'][$provider]) || !is_array($doc['stats'][$provider])) {
                $doc['stats'][$provider] = [];
            }
            $prov = &$doc['stats'][$provider];
            if (!isset($prov[$kind]) || !is_array($prov[$kind])) {
                $prov[$kind] = ['calls' => 0, 'ok' => 0, 'failed' => 0];
            }
            $prov[$kind]['calls']++;
            $prov[$kind][$entry['success'] ? 'ok' : 'failed']++;
            $prov['last_ts'] = $ts;
            $prov['last_model'] = $entry['model'];
            unset($prov);
            self::save($doc);
        });
    }

    /**
     * Newest-first records (+ full per-provider/kind rollup) for the UI.
     * Optional $kind filters the records (stats stay the full rollup).
     *
     * @return array{success: bool, storage_path: string, stats: array, entries: array}
     */
    public static function log(int $limit = 100, ?string $kind = null): array
    {
        $limit = max(1, min(self::MAX_ENTRIES, $limit));
        $kind = $kind !== null && $kind !== '' ? strtolower(trim($kind)) : null;
        $doc = self::load();
        $records = array_reverse($doc['entries']);
        if ($kind !== null) {
            $records = array_values(array_filter($records, static fn ($r) => ($r['kind'] ?? null) === $kind));
        }
        return [
            'success' => true,
            'storage_path' => self::file(),
            'stats' => $doc['stats'],
            'entries' => array_slice($records, 0, $limit),
        ];
    }

    /** Delete ALL usage records + stats. Returns the count removed. */
    public static function clear(): int
    {
        return (int) self::withLock(static function (): int {
            $doc = self::load();
            $n = count($doc['entries']);
            $doc['entries'] = [];
            $doc['stats'] = [];
            self::save($doc);
            return $n;
        });
    }

    // --- internals --------------------------------------------------------- //

    /** @return array{version: int, saved_at: float, entries: array, stats: array} */
    private static function load(): array
    {
        $path = self::file();
        if (is_file($path)) {
            $raw = @file_get_contents($path);
            if ($raw !== false && $raw !== '') {
                $decoded = json_decode($raw, true);
                if (is_array($decoded)) {
                    return [
                        'version' => isset($decoded['version']) ? (int) $decoded['version'] : 1,
                        'saved_at' => isset($decoded['saved_at']) ? (float) $decoded['saved_at'] : 0.0,
                        'entries' => is_array($decoded['entries'] ?? null) ? $decoded['entries'] : [],
                        'stats' => is_array($decoded['stats'] ?? null) ? $decoded['stats'] : [],
                    ];
                }
            }
        }
        return ['version' => 1, 'saved_at' => 0.0, 'entries' => [], 'stats' => []];
    }

    private static function save(array $doc): void
    {
        $path = self::file();
        $dir = dirname($path);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $doc['version'] = 1;
        $doc['saved_at'] = microtime(true);
        $tmp = $path . '.tmp.' . getmypid();
        if (@file_put_contents($tmp, json_encode($doc, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) !== false) {
            @rename($tmp, $path);
        } else {
            @unlink($tmp);
        }
    }

    /**
     * @template T
     * @param  callable():T  $fn
     * @return T
     */
    private static function withLock(callable $fn)
    {
        $dir = self::stateDir();
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $lockPath = self::file() . '.lock';
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
}
