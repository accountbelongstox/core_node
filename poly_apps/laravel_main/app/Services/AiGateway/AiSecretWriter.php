<?php

namespace App\Services\AiGateway;

use App\Providers\PathMapper;

/**
 * AiSecretWriter manages the writable side of the AI secret store under
 * <core_node>/.secret_keys/.secret_ignore/<KEY>, the exact same files pycore
 * reads, so a key set here works in BOTH runtimes immediately.
 *
 * Scope is deliberately narrow:
 *   - It NEVER touches the global_var store (RuntimeConfigurationStore::put) — that is a
 *     DIFFERENT store with different semantics.
 *   - It only allows writing key names that match a KNOWN provider key base /
 *     extra-secret / image / base-url pattern (isAllowedKeyName), so an arbitrary
 *     file path can never be created from the UI.
 *   - It writes atomically (tmp + rename) and chmods 0600; the directory is
 *     created 0700 when missing.
 *
 * Values are SECRETS: this class only writes/deletes — masking + read-back for
 * the UI go through AiProviderRegistry::maskKey / SecretStore.
 */
class AiSecretWriter
{
    /** Numbered-variant range — MUST match SecretStore's scan (BASE_1 .. BASE_5);
     *  a key written above this range would be silently never read. */
    private const MAX_INDEX = 5;

    /**
     * Secret directory: <core_node>/.secret_keys/.secret_ignore (created 0700).
     */
    public static function dir(): string
    {
        $dir = rtrim((string) PathMapper::getCoreNodeDir(), '/\\')
            . DIRECTORY_SEPARATOR . '.secret_keys'
            . DIRECTORY_SEPARATOR . '.secret_ignore';

        if (!is_dir($dir)) {
            @mkdir($dir, 0700, true);
            @chmod($dir, 0700);
        }

        return $dir;
    }

    /**
     * Collect every known registry base name: each provider key_base + every
     * extra_secret name. These are the only roots the allow-list accepts.
     *
     * @return string[]
     */
    private static function knownBases(): array
    {
        $bases = [];
        foreach (AiProviderRegistry::providers() as $meta) {
            $base = strtoupper(trim((string) ($meta['key_base'] ?? '')));
            if ($base !== '') {
                $bases[$base] = true;
            }
            $extra = strtoupper(trim((string) ($meta['extra_secret'] ?? '')));
            if ($extra !== '') {
                $bases[$extra] = true;
            }
            // base_url override secret name (e.g. SILICONFLOW_BASE_URL) is a
            // distinct base in its own right.
            $urlKey = strtoupper(trim((string) ($meta['base_url_key'] ?? '')));
            if ($urlKey !== '') {
                $bases[$urlKey] = true;
            }
        }
        return array_keys($bases);
    }

    /**
     * Aux (non-key) secret names declared by providers — endpoint / deployment /
     * region / the spark APP_ID-API_KEY-API_SECRET triple — that image backends
     * need but that aren't the main key_base/extra_secret. Collected from each
     * provider's `aux_secrets` registry field.
     *
     * @return string[]
     */
    private static function knownAux(): array
    {
        $aux = [];
        foreach (AiProviderRegistry::providers() as $meta) {
            foreach ((array) ($meta['aux_secrets'] ?? []) as $name) {
                $name = strtoupper(trim((string) $name));
                if ($name !== '') {
                    $aux[$name] = true;
                }
            }
        }
        return array_keys($aux);
    }

    /**
     * True when $name is a writable AI secret name. Accepts, for any known
     * registry base <BASE>:
     *   <BASE>            <BASE>_<1-5>
     *   <BASE>_IMAGE      <BASE>_IMAGE_<1-5>
     *   <BASE>_BASE_URL   <BASE>_BASE_URL_<1-5>
     * plus any declared aux secret name (optionally numbered _1.._5). The name
     * must also match ^[A-Z0-9_]+$. Anything else is rejected so the UI can never
     * write to an arbitrary path. Index range is pinned to SecretStore's scan.
     */
    public static function isAllowedKeyName(string $name): bool
    {
        $name = strtoupper(trim($name));
        if ($name === '' || !preg_match('/^[A-Z0-9_]+$/', $name)) {
            return false;
        }

        $idx = '(_[1-' . self::MAX_INDEX . '])?';

        // Aux provider secrets (endpoint / deployment / region / spark triple).
        foreach (self::knownAux() as $aux) {
            if (preg_match('/^' . preg_quote($aux, '/') . $idx . '$/', $name)) {
                return true;
            }
        }

        foreach (self::knownBases() as $base) {
            $b = preg_quote($base, '/');
            $patterns = [
                '/^' . $b . $idx . '$/',
                '/^' . $b . '_IMAGE' . $idx . '$/',
                '/^' . $b . '_BASE_URL' . $idx . '$/',
            ];
            foreach ($patterns as $re) {
                if (preg_match($re, $name)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * True when a raw secret file exists for this exact key name.
     */
    public static function rawExists(string $keyName): bool
    {
        $keyName = strtoupper(trim($keyName));
        if ($keyName === '' || !preg_match('/^[A-Z0-9_]+$/', $keyName)) {
            return false;
        }
        return is_file(self::dir() . DIRECTORY_SEPARATOR . $keyName);
    }

    /**
     * Write a secret value atomically (tmp file + rename), chmod 0600.
     * Validates the name shape (^[A-Z0-9_]+$) and a trimmed non-empty value.
     * Returns true on success.
     */
    public static function set(string $keyName, string $value): bool
    {
        $keyName = strtoupper(trim($keyName));
        if ($keyName === '' || !preg_match('/^[A-Z0-9_]+$/', $keyName)) {
            return false;
        }

        $value = trim($value);
        if ($value === '') {
            return false;
        }

        $dir = self::dir();
        if (!is_dir($dir)) {
            return false;
        }

        $target = $dir . DIRECTORY_SEPARATOR . $keyName;
        $tmp = $target . '.tmp.' . getmypid() . '.' . bin2hex(random_bytes(4));

        if (@file_put_contents($tmp, $value, LOCK_EX) === false) {
            @unlink($tmp);
            return false;
        }
        @chmod($tmp, 0600);

        if (!@rename($tmp, $target)) {
            @unlink($tmp);
            return false;
        }
        @chmod($target, 0600);

        return true;
    }

    /**
     * Delete a secret file (and the matching already_encrypted/<KEY>.js if any).
     * Validates the name shape. Returns true when the raw file is gone after the
     * call (already-absent counts as success).
     */
    public static function delete(string $keyName): bool
    {
        $keyName = strtoupper(trim($keyName));
        if ($keyName === '' || !preg_match('/^[A-Z0-9_]+$/', $keyName)) {
            return false;
        }

        $raw = self::dir() . DIRECTORY_SEPARATOR . $keyName;
        if (is_file($raw)) {
            @unlink($raw);
        }

        // Best-effort: drop a matching pre-encrypted variant so a stale
        // already_encrypted/<KEY>.js doesn't shadow the deletion on read.
        $encrypted = rtrim((string) PathMapper::getCoreNodeDir(), '/\\')
            . DIRECTORY_SEPARATOR . '.secret_keys'
            . DIRECTORY_SEPARATOR . 'already_encrypted'
            . DIRECTORY_SEPARATOR . $keyName . '.js';
        if (is_file($encrypted)) {
            @unlink($encrypted);
        }

        return !is_file($raw);
    }
}
