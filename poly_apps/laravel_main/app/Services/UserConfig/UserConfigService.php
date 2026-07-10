<?php

namespace App\Services\UserConfig;

use App\Providers\PathMapper;
use Illuminate\Support\Facades\Log;

/**
 * User-data-area configuration loader - the single source of truth for
 * application feature settings, kept OUT of Laravel's .env (which stays for
 * bootstrap essentials only: DB / APP_KEY / APP_URL).
 *
 * Storage: a JSON file in the user-data area
 * (<laravel_data_dir>/config/settings.json), resolved via PathMapper so it
 * follows the SAME persisted base-data-dir the shell installer / pycore use
 * (see PathMapper::getBaseDataDirectory -> /var/_core_node/global_var/
 * BASE_DATA_DIR). Both the task-center UI toggle and backend services read +
 * write through here.
 *
 * Resolution priority for get(): user-data JSON > OS env (legacy .env values
 * still work as a fallback during migration) > caller default. So "if the user
 * data area has a config, it wins" (the required behavior).
 *
 * Concurrency: set() does a locked read-modify-write (flock) so concurrent
 * Octane workers / HTTP requests never corrupt the file. The decoded JSON is
 * memoized per request (and reloaded lazily when its mtime advances).
 */
class UserConfigService
{
    /** Relative path under the Laravel data dir for the settings file. */
    private const SETTINGS_REL_PATH = 'config/settings.json';

    /** Memoized decoded settings (null = not loaded yet). */
    private ?array $cache = null;

    /** Memoized file mtime at load time, to detect external writes. */
    private ?int $loadedMtime = null;

    /**
     * Absolute path to the user-data settings JSON file.
     */
    public function filePath(): string
    {
        return PathMapper::getLaravelDataDir(self::SETTINGS_REL_PATH);
    }

    /**
     * Read a setting. Priority: user-data JSON > env (legacy .env fallback) >
     * $default. Scalar cast follows $default's type (bool/int/string).
     *
     * @param string $key   Dotted setting key (e.g. "use_server_binary_assist").
     * @param mixed  $default
     * @return mixed
     */
    public function get(string $key, $default = null)
    {
        $json = $this->load();
        if (is_array($json) && array_key_exists($key, $json)) {
            return $this->cast($json[$key], $default);
        }

        // Legacy .env fallback: use_server_binary_assist -> USE_SERVER_BINARY_ASSIST.
        $envKey = strtoupper(str_replace(['-', '.'], '_', $key));
        $envVal = getenv($envKey);
        if (is_string($envVal) && $envVal !== '') {
            return $this->cast($envVal, $default);
        }

        return $default;
    }

    /**
     * Write a setting to the user-data JSON (locked read-modify-write).
     * Never throws - a write failure is logged and returns false so callers
     * (HTTP toggle endpoints) can report it without 500ing.
     *
     * @param string $key
     * @param mixed  $value
     * @return bool
     */
    public function set(string $key, $value): bool
    {
        $path = $this->filePath();
        $dir = dirname($path);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }

        $fp = @fopen($path, 'c+');
        if ($fp === false) {
            Log::warning('[UserConfig] cannot open settings file for write', ['path' => $path]);
            return false;
        }

        try {
            if (!flock($fp, LOCK_EX)) {
                Log::warning('[UserConfig] cannot acquire write lock', ['path' => $path]);
                return false;
            }

            $raw = '';
            $size = (int) filesize($path);
            if ($size > 0) {
                $raw = (string) stream_get_contents($fp);
            }
            $data = $this->decode($raw);

            if ($value === null) {
                unset($data[$key]);
            } else {
                $data[$key] = $value;
            }

            // Atomic-ish write: truncate + rewrite under the lock.
            rewind($fp);
            ftruncate($fp, 0);
            fwrite($fp, $this->encode($data));
            fflush($fp);

            // Refresh the memoized cache so a subsequent get() in the same
            // request reflects the new value.
            $this->cache = $data;
            $this->loadedMtime = @filemtime($path) ?: null;

            return true;
        } finally {
            if (is_resource($fp)) {
                flock($fp, LOCK_UN);
                fclose($fp);
            }
        }
    }

    /** Return the full settings array (decoded JSON, empty array on any error). */
    public function all(): array
    {
        return $this->load();
    }

    /**
     * Convenience: whether the server may call local TTS binaries as an assist.
     * Default OFF - Laravel delegates all synthesis to pycore; ON = desktop
     * fallback where no pycore worker is available.
     */
    public function useServerBinaryAssist(): bool
    {
        return (bool) $this->get('use_server_binary_assist', false);
    }

    /**
     * Lazily load + memoize the decoded JSON, reloading when the file mtime
     * advances (so writes from another worker/HTTP request are picked up).
     *
     * @return array
     */
    private function load(): array
    {
        $path = $this->filePath();
        $mtime = @filemtime($path);
        if ($mtime === false) {
            $mtime = null;
        }

        if ($this->cache !== null && $this->loadedMtime !== null && $mtime === $this->loadedMtime) {
            return $this->cache;
        }

        $raw = is_file($path) ? (string) @file_get_contents($path) : '';
        $this->cache = $this->decode($raw);
        $this->loadedMtime = $mtime;
        return $this->cache;
    }

    private function decode(string $raw): array
    {
        if ($raw === '') {
            return [];
        }
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    private function encode(array $data): string
    {
        $out = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        return is_string($out) ? $out : '{}';
    }

    /**
     * Cast a stored/env value to the type of $default (bool/int/string).
     * Env values are strings ("true"/"false"/"1"/"0"); JSON values keep type.
     *
     * @param mixed $value
     * @param mixed $default
     * @return mixed
     */
    private function cast($value, $default)
    {
        if (is_bool($default)) {
            if (is_bool($value)) {
                return $value;
            }
            if (is_string($value)) {
                $lower = strtolower($value);
                return in_array($lower, ['1', 'true', 'yes', 'on'], true);
            }
            return (bool) $value;
        }
        if (is_int($default)) {
            return is_int($value) ? $value : (int) $value;
        }
        if (is_array($default)) {
            return is_array($value) ? $value : $default;
        }
        return is_string($value) ? $value : (string) $value;
    }
}
