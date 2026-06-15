<?php

namespace App\Services\AiGateway;

use App\Providers\PathMapper;

/**
 * Per-KEY rotation state for AI providers — the PHP twin of pycore's
 * pyctl/ai/ai_key_rotation.py.
 *
 * A provider may have several keys (<BASE>_1 .. <BASE>_N). This tracks, per
 * (rotationKey, slot):
 *   - cooldown_until (set when that key hits a rate-limit / quota / 429), so the
 *     next request rotates to the NEXT key instead of hammering the exhausted one
 *     AND so a dead/blocked provider is SKIPPED until it recovers;
 *   - live counters (used / ok / failed / last_used / last_error) + per-key rate
 *     windows (minute sliding + per-day) for the UI and per-key budgeting.
 *
 * selectActive($rotationKey, $keys) returns the first key NOT on cooldown (or,
 * when all are cooled, the one whose cooldown expires soonest).
 *
 * rotationKey is the provider name for TEXT and "<provider>#image" for IMAGE, so
 * an image key cooldown can never block text and vice-versa (matching pycore).
 *
 * Persistence mirrors AiRateLimiter: a shared JSON file under
 * <core_node>/.data/.ai_state (flock'd, atomic tmp+rename) so cooldown/counters
 * survive restarts AND are consistent across Octane workers. cooldown_until is an
 * ABSOLUTE wall-clock microtime (cross-worker safe). This is Laravel's own
 * per-key store (pycore keeps its in-memory equivalent); the schema mirrors
 * pycore so the two can interoperate if ever merged.
 */
class AiKeyRotation
{
    public const DEFAULT_KEY_COOLDOWN_S = 120.0;

    private static function stateFile(): string
    {
        $coreNode = PathMapper::getCoreNodeDir() ?: PathMapper::getLaravelMainDir();
        return rtrim($coreNode, '/\\') . '/.data/.ai_state/ai_key_rotation.json';
    }

    // ------------------------------------------------------------------ store

    private static function load(): array
    {
        $path = self::stateFile();
        if (is_file($path)) {
            $raw = @file_get_contents($path);
            if ($raw !== false && $raw !== '') {
                $decoded = json_decode($raw, true);
                if (is_array($decoded) && isset($decoded['providers']) && is_array($decoded['providers'])) {
                    return $decoded;
                }
            }
        }
        return ['providers' => []];
    }

    private static function save(array $data): void
    {
        $path = self::stateFile();
        $dir = dirname($path);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $data['saved_at'] = microtime(true);
        $tmp = $path . '.tmp.' . getmypid();
        if (@file_put_contents($tmp, json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) !== false) {
            @rename($tmp, $path);
        }
    }

    /** flock'd read-modify-write (cross Octane-worker safe), mirroring AiRateLimiter. */
    private static function withLock(callable $fn)
    {
        $path = self::stateFile();
        $dir = dirname($path);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $handle = @fopen($path . '.lock', 'c');
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

    private static function &slot(array &$data, string $rotationKey, int $idx): array
    {
        if (!isset($data['providers'][$rotationKey]) || !is_array($data['providers'][$rotationKey])) {
            $data['providers'][$rotationKey] = [];
        }
        $key = (string) $idx;
        if (!isset($data['providers'][$rotationKey][$key])) {
            $data['providers'][$rotationKey][$key] = [
                'index' => $idx, 'masked' => '', 'cooldown_until' => 0.0,
                'used' => 0, 'ok' => 0, 'failed' => 0,
                'last_used' => null, 'last_error' => null,
                'minute' => [], 'day' => [],
            ];
        }
        return $data['providers'][$rotationKey][$key];
    }

    private static function mask(string $key): string
    {
        $key = trim($key);
        return strlen($key) <= 8 ? '…' : substr($key, 0, 4) . '…' . substr($key, -4);
    }

    private static function today(): string
    {
        return gmdate('Y-m-d');
    }

    // ---------------------------------------------------------------- public

    /**
     * Pick the active key: first slot NOT in cooldown; if every key is cooling,
     * the slot whose cooldown expires soonest. Returns [slotIndex, key]; [-1, '']
     * when $keys is empty. slotIndex is the 0-based position (UI: KEY{index+1}).
     */
    public static function selectActive(string $rotationKey, array $keys): array
    {
        $keys = array_values($keys);
        if (empty($keys)) {
            return [-1, ''];
        }
        return self::withLock(static function () use ($rotationKey, $keys) {
            $data = self::load();
            $now = microtime(true);
            $bestIdx = 0;
            $bestCd = INF;
            foreach ($keys as $idx => $key) {
                $st = &self::slot($data, $rotationKey, $idx);
                $st['masked'] = self::mask((string) $key);
                $cd = (float) $st['cooldown_until'];
                if ($cd <= $now) {
                    self::save($data);
                    return [$idx, $keys[$idx]];
                }
                if ($cd < $bestCd) {
                    $bestCd = $cd;
                    $bestIdx = $idx;
                }
                unset($st);
            }
            self::save($data);
            return [$bestIdx, $keys[$bestIdx]];
        });
    }

    /** Put one key slot on cooldown after a rate-limit / quota / unreachable failure. */
    public static function markCooldown(string $rotationKey, int $idx, ?float $secs = null, ?string $error = null): void
    {
        if ($idx < 0) {
            return;
        }
        $secs = $secs ?? self::DEFAULT_KEY_COOLDOWN_S;
        self::withLock(static function () use ($rotationKey, $idx, $secs, $error) {
            $data = self::load();
            $st = &self::slot($data, $rotationKey, $idx);
            $st['cooldown_until'] = microtime(true) + max(1.0, $secs);
            if ($error !== null && $error !== '') {
                $st['last_error'] = mb_substr($error, 0, 160);
            }
            unset($st);
            self::save($data);
        });
    }

    /** Count one attempt against a key slot: lifetime counters + per-key rate windows. */
    public static function record(string $rotationKey, int $idx, bool $ok, ?string $error = null): void
    {
        if ($idx < 0) {
            return;
        }
        self::withLock(static function () use ($rotationKey, $idx, $ok, $error) {
            $data = self::load();
            $st = &self::slot($data, $rotationKey, $idx);
            $now = microtime(true);
            $st['used']++;
            $st['last_used'] = $now;
            if ($ok) {
                $st['ok']++;
            } else {
                $st['failed']++;
                if ($error !== null && $error !== '') {
                    $st['last_error'] = mb_substr($error, 0, 160);
                }
            }
            $minute = array_values(array_filter((array) $st['minute'], static fn ($t) => ($now - (float) $t) < 60.0));
            $minute[] = $now;
            $st['minute'] = $minute;
            $today = self::today();
            $day = (array) $st['day'];
            $day[$today] = (int) ($day[$today] ?? 0) + 1;
            if (count($day) > 5) {
                ksort($day);
                $day = array_slice($day, -3, null, true);
            }
            $st['day'] = $day;
            unset($st);
            self::save($data);
        });
    }

    /**
     * True when the key slot is WITHIN its per-key budget (minute & day). $rpm /
     * $rpd null = no enforcement. Each key gets the FULL provider budget (distinct
     * keys are distinct accounts/quotas).
     */
    public static function rateOk(string $rotationKey, int $idx, ?int $rpm = null, ?int $rpd = null): bool
    {
        if ($idx < 0 || ($rpm === null && $rpd === null)) {
            return true;
        }
        return self::withLock(static function () use ($rotationKey, $idx, $rpm, $rpd) {
            $data = self::load();
            $st = &self::slot($data, $rotationKey, $idx);
            $now = microtime(true);
            $minute = array_values(array_filter((array) $st['minute'], static fn ($t) => ($now - (float) $t) < 60.0));
            $st['minute'] = $minute;
            $dayMap = (array) $st['day'];
            $dayUsed = (int) ($dayMap[self::today()] ?? 0);
            unset($st);
            self::save($data);
            if ($rpm !== null && count($minute) >= $rpm) {
                return false;
            }
            if ($rpd !== null && $dayUsed >= $rpd) {
                return false;
            }
            return true;
        });
    }

    /** True if at least one key slot is NOT on cooldown — provider usable now. */
    public static function hasReadyKey(string $rotationKey, array $keys): bool
    {
        $keys = array_values($keys);
        if (empty($keys)) {
            return false;
        }
        return self::withLock(static function () use ($rotationKey, $keys) {
            $data = self::load();
            $now = microtime(true);
            $ready = false;
            foreach ($keys as $idx => $key) {
                $st = &self::slot($data, $rotationKey, $idx);
                if ((float) $st['cooldown_until'] <= $now) {
                    $ready = true;
                    unset($st);
                    break;
                }
                unset($st);
            }
            self::save($data);
            return $ready;
        });
    }

    /** Clear cooldown for one slot ($idx) or ALL slots of $rotationKey. Returns count reset. */
    public static function resetCooldown(string $rotationKey, ?int $idx = null): int
    {
        return (int) self::withLock(static function () use ($rotationKey, $idx) {
            $data = self::load();
            $slots = $data['providers'][$rotationKey] ?? [];
            $n = 0;
            foreach ($slots as $key => $st) {
                if ($idx !== null && (string) $idx !== (string) $key) {
                    continue;
                }
                if ((float) ($st['cooldown_until'] ?? 0.0) > 0.0) {
                    $data['providers'][$rotationKey][$key]['cooldown_until'] = 0.0;
                    $n++;
                }
            }
            if ($n > 0) {
                self::save($data);
            }
            return $n;
        });
    }

    /** Per-key status for the UI: index / label / masked / cooldown_s / counters / rate usage. */
    public static function status(string $rotationKey, array $keys): array
    {
        $keys = array_values($keys);
        $data = self::load();
        $now = microtime(true);
        $today = self::today();
        $out = [];
        foreach ($keys as $idx => $key) {
            $st = $data['providers'][$rotationKey][(string) $idx] ?? null;
            $cd = $st ? (float) ($st['cooldown_until'] ?? 0.0) : 0.0;
            $minute = $st ? array_filter((array) ($st['minute'] ?? []), static fn ($t) => ($now - (float) $t) < 60.0) : [];
            $out[] = [
                'index' => $idx,
                'label' => 'KEY' . ($idx + 1),
                'masked' => self::mask((string) $key),
                'cooldown_s' => max(0, (int) ceil($cd - $now)),
                'used' => $st ? (int) ($st['used'] ?? 0) : 0,
                'ok' => $st ? (int) ($st['ok'] ?? 0) : 0,
                'failed' => $st ? (int) ($st['failed'] ?? 0) : 0,
                'minute_used' => count($minute),
                'day_used' => $st ? (int) (((array) ($st['day'] ?? []))[$today] ?? 0) : 0,
                'last_used' => $st['last_used'] ?? null,
                'last_error' => $st['last_error'] ?? null,
            ];
        }
        return $out;
    }
}
