<?php

namespace App\Services\AiGateway;

use App\Providers\PathMapper;

/**
 * Shared AI image-generation history — the PHP twin of pycore's
 * pyctl.ai.ai_image_history, sharing the SAME on-disk store.
 *
 * pycore (Windows host) and Laravel (WSL) read/write ONE set of files so the
 * image-tools gallery is identical on both ends. The only filesystem path both
 * resolve to a single physical file is the core_node repo root (D:\..\core_node
 * on Windows == /mnt/d/..\core_node in WSL via DrvFs), so the store lives under
 * <core_node>/.ai_state — the same channel ai_rate_usage.json / .secret_keys use:
 *
 *   <core_node>/.ai_state/ai_image_history.json   newest-LAST index (ring 200)
 *   <core_node>/.ai_state/ai_images/<id>.<ext>    the generated image bytes
 *
 * Index doc:  { version: 1, saved_at: float, entries: [ <entry>, ... ] }
 * Entry (NO base64 in the index — bytes live in the image file):
 *   { id, ts, iso, provider, model, prompt, size, mime, bytes, file,
 *     latency_ms, source, origin: 'pycore'|'laravel', ok }
 *
 * Write safety mirrors AiRateLimiter: a tmp file + atomic rename, serialized by
 * an flock'd lock file so concurrent Octane workers (and the pycore atomic
 * replace) never corrupt the document.
 */
class AiImageHistory
{
    /** Newest-last ring buffer cap; older entries + their image files are trimmed. */
    private const MAX_ENTRIES = 200;

    /** Bound prompt length stored in the index (matches pycore). */
    private const PROMPT_MAX = 2000;

    /** mime -> file extension (matches pycore _MIME_EXT, default png). */
    private const MIME_EXT = [
        'image/png' => 'png',
        'image/jpeg' => 'jpg',
        'image/jpg' => 'jpg',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];

    /** Absolute path of the shared .ai_state dir (same dir pycore writes). */
    public static function stateDir(): string
    {
        $coreNode = PathMapper::getCoreNodeDir() ?: PathMapper::getLaravelMainDir();
        return rtrim($coreNode, '/\\') . '/.ai_state';
    }

    /** Absolute path of the shared history index file. */
    public static function indexFile(): string
    {
        return self::stateDir() . '/ai_image_history.json';
    }

    /** Absolute path of the shared image bytes dir. */
    public static function imagesDir(): string
    {
        return self::stateDir() . '/ai_images';
    }

    /**
     * Persist a generated image (bytes file + index entry) to the shared store.
     *
     * Best-effort: any storage failure returns null (never throws) so image
     * delivery to the caller never depends on history succeeding.
     *
     * @param  array<string, mixed>  $meta  provider, model, prompt, size, mime, latency_ms, source, origin, ok
     * @return array<string, mixed>|null    the stored index entry (NO base64), or null
     */
    public static function record(array $meta, string $imageBase64): ?array
    {
        if ($imageBase64 === '') {
            return null;
        }
        $raw = base64_decode($imageBase64, true);
        if ($raw === false || $raw === '') {
            return null;
        }

        $ts = microtime(true);
        $provider = (string) ($meta['provider'] ?? '');
        $prompt = (string) ($meta['prompt'] ?? '');
        $mime = (string) ($meta['mime'] ?? 'image/png');
        if ($mime === '') {
            $mime = 'image/png';
        }
        // Match pycore: sha1("<ts>:<provider>:<prompt>"), first 16 hex chars.
        $id = substr(sha1($ts . ':' . $provider . ':' . $prompt), 0, 16);
        $ext = self::extFor($mime);
        $rel = 'ai_images/' . $id . '.' . $ext;

        $latency = $meta['latency_ms'] ?? null;
        $entry = [
            'id' => $id,
            'ts' => $ts,
            // Match pycore datetime.fromtimestamp(ts, utc).isoformat(timespec="seconds"),
            // which renders the offset as "+00:00" (not "Z").
            'iso' => gmdate('Y-m-d\TH:i:s+00:00', (int) $ts),
            'provider' => $provider,
            'model' => (string) ($meta['model'] ?? ''),
            'prompt' => self::clipPrompt($prompt),
            'size' => (string) ($meta['size'] ?? ''),
            'mime' => $mime,
            'bytes' => strlen($raw),
            'file' => $rel,
            'latency_ms' => $latency === null ? null : (is_numeric($latency) ? $latency + 0 : $latency),
            'source' => (string) ($meta['source'] ?? 'image'),
            'origin' => (string) ($meta['origin'] ?? 'laravel'),
            'ok' => array_key_exists('ok', $meta) ? (bool) $meta['ok'] : true,
        ];

        return self::withLock(static function () use ($entry, $rel, $raw): ?array {
            $imagesDir = self::imagesDir();
            if (!is_dir($imagesDir)) {
                @mkdir($imagesDir, 0775, true);
            }
            if (@file_put_contents(self::stateDir() . '/' . $rel, $raw) === false) {
                return null;
            }
            $doc = self::load();
            $doc['entries'][] = $entry;
            self::trim($doc);
            self::save($doc);
            return $entry;
        });
    }

    /**
     * Newest-first index entries (metadata only), capped at $limit (1..200).
     *
     * @return array<int, array<string, mixed>>
     */
    public static function list(int $limit = 50): array
    {
        $limit = max(1, min(self::MAX_ENTRIES, $limit));
        $entries = self::load()['entries'];
        $entries = array_reverse($entries);
        return array_slice($entries, 0, $limit);
    }

    /**
     * Image bytes + mime for a stored id, or null when missing.
     *
     * @return array{bytes: string, mime: string}|null
     */
    public static function read(string $id): ?array
    {
        $id = trim($id);
        if ($id === '') {
            return null;
        }
        $rel = null;
        $mime = 'image/png';
        foreach (self::load()['entries'] as $e) {
            if (($e['id'] ?? null) === $id) {
                $rel = $e['file'] ?? null;
                $mime = (string) ($e['mime'] ?? 'image/png');
                break;
            }
        }
        if ($rel === null) {
            return null;
        }
        $bytes = @file_get_contents(self::stateDir() . '/' . $rel);
        if ($bytes === false) {
            return null;
        }
        return ['bytes' => $bytes, 'mime' => $mime !== '' ? $mime : 'image/png'];
    }

    /** Remove one history entry + its image file. True when an entry was removed. */
    public static function delete(string $id): bool
    {
        $id = trim($id);
        if ($id === '') {
            return false;
        }
        return (bool) self::withLock(static function () use ($id): bool {
            $doc = self::load();
            $keep = [];
            $removed = null;
            foreach ($doc['entries'] as $e) {
                if ($removed === null && ($e['id'] ?? null) === $id) {
                    $removed = $e;
                } else {
                    $keep[] = $e;
                }
            }
            if ($removed === null) {
                return false;
            }
            $doc['entries'] = $keep;
            self::save($doc);
            $rel = $removed['file'] ?? null;
            if ($rel) {
                @unlink(self::stateDir() . '/' . $rel);
            }
            return true;
        });
    }

    /** Delete ALL history entries + image files. Returns the count removed. */
    public static function clear(): int
    {
        return (int) self::withLock(static function (): int {
            $doc = self::load();
            $base = self::stateDir();
            foreach ($doc['entries'] as $e) {
                $rel = $e['file'] ?? null;
                if ($rel) {
                    @unlink($base . '/' . $rel);
                }
            }
            $n = count($doc['entries']);
            $doc['entries'] = [];
            self::save($doc);
            return $n;
        });
    }

    // --- internals --------------------------------------------------------- //

    private static function extFor(string $mime): string
    {
        $key = strtolower(trim(explode(';', $mime)[0]));
        return self::MIME_EXT[$key] ?? 'png';
    }

    private static function clipPrompt(string $prompt): string
    {
        // pycore slices the first 2000 chars (unicode code points). mb_substr
        // matches that; ASCII prompts are identical either way.
        return mb_strlen($prompt) > self::PROMPT_MAX ? mb_substr($prompt, 0, self::PROMPT_MAX) : $prompt;
    }

    /**
     * Load the shared index doc, normalizing to { version, saved_at, entries }.
     * A corrupt/missing index yields a fresh empty doc (never throws).
     *
     * @return array{version: int, saved_at: float, entries: array<int, array<string, mixed>>}
     */
    private static function load(): array
    {
        $path = self::indexFile();
        if (is_file($path)) {
            $raw = @file_get_contents($path);
            if ($raw !== false && $raw !== '') {
                $decoded = json_decode($raw, true);
                if (is_array($decoded) && isset($decoded['entries']) && is_array($decoded['entries'])) {
                    $decoded['version'] = isset($decoded['version']) ? (int) $decoded['version'] : 1;
                    $decoded['saved_at'] = isset($decoded['saved_at']) ? (float) $decoded['saved_at'] : 0.0;
                    return $decoded;
                }
            }
        }
        return ['version' => 1, 'saved_at' => 0.0, 'entries' => []];
    }

    /**
     * Trim to the newest MAX_ENTRIES, deleting dropped entries' image files.
     *
     * @param  array{entries: array<int, array<string, mixed>>}  $doc
     */
    private static function trim(array &$doc): void
    {
        $entries = $doc['entries'];
        $count = count($entries);
        if ($count <= self::MAX_ENTRIES) {
            return;
        }
        $cut = $count - self::MAX_ENTRIES;
        $drop = array_slice($entries, 0, $cut);
        $doc['entries'] = array_values(array_slice($entries, $cut));
        $base = self::stateDir();
        foreach ($drop as $e) {
            $rel = $e['file'] ?? null;
            if ($rel) {
                @unlink($base . '/' . $rel);
            }
        }
    }

    /**
     * Atomically write the index doc (tmp file + rename), matching pycore's
     * os.replace and AiRateLimiter::save. version stays 1, saved_at refreshed.
     *
     * @param  array{version?: int, saved_at?: float, entries: array<int, mixed>}  $doc
     */
    private static function save(array $doc): void
    {
        $path = self::indexFile();
        $dir = dirname($path);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $doc['version'] = 1;
        $doc['saved_at'] = microtime(true);
        $tmp = $path . '.tmp.' . getmypid();
        // ensure_ascii=False parity: keep unicode + slashes unescaped.
        if (@file_put_contents($tmp, json_encode($doc, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) !== false) {
            @rename($tmp, $path);
        } else {
            @unlink($tmp);
        }
    }

    /**
     * Serialize a read-modify-write across Octane workers with an flock'd lock
     * file (same pattern as AiRateLimiter). Cross-runtime (vs pycore) safety
     * still rests on the atomic rename in save(); image generations are seconds
     * apart so the lost-update window is negligible.
     *
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
        $lockPath = self::indexFile() . '.lock';
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
