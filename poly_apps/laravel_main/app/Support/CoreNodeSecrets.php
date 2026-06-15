<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Support;

/**
 * Runtime secret reader (the "helper" half of the shell-generated credential
 * bridge).
 *
 * All service passwords (e.g. the PostgreSQL superuser password) are GENERATED
 * by the install/start shell scripts and stored in the shared, file-backed
 * global-var store written by scripts/shells/linux/common/gvar_common.sh
 * (set_global_var -> {CORE_NODE_DATA_DIR}/global_var/<KEY>, default
 * /var/_core_node/global_var/<KEY>, value + trailing newline).
 *
 * This class reads that store so generated credentials reach Laravel WITHOUT
 * ever being written into .env. That is deliberate: .env files get copied and
 * committed around and would leak the password. The store lives outside the repo
 * and is owned/rotated by the .sh scripts; Laravel only ever reads it.
 *
 * Key normalization mirrors gvar_common.sh _get_var_file_path(): uppercase the
 * key, then keep only [A-Z0-9_].
 */
class CoreNodeSecrets
{
    /**
     * Resolve the global-var directory. Honors the CORE_NODE_DATA_DIR process
     * environment variable (set by the shell toolchain) and defaults to the
     * canonical /var/_core_node location used by gvar_common.sh.
     */
    public static function dir(): string
    {
        $base = getenv('CORE_NODE_DATA_DIR');
        if ($base === false || $base === '') {
            $base = '/var/_core_node';
        }

        return rtrim($base, '/') . '/global_var';
    }

    /**
     * Read a generated secret/value by its global-var key. Returns $default when
     * the store file is absent, unreadable, or empty (e.g. on Windows, or before
     * the install scripts have run).
     */
    public static function get(string $key, ?string $default = null): ?string
    {
        $normalized = preg_replace('/[^A-Z0-9_]/', '', strtoupper($key));
        if ($normalized === '') {
            return $default;
        }

        $path = self::dir() . '/' . $normalized;
        if (!is_file($path) || !is_readable($path)) {
            return $default;
        }

        $value = @file_get_contents($path);
        if ($value === false) {
            return $default;
        }

        $value = trim($value);

        return $value === '' ? $default : $value;
    }

    /**
     * Write/rotate a secret into the global-var store, in the SAME format
     * gvar_common.sh uses (value + trailing newline), so the install/start shell
     * scripts and Laravel's config read back the identical value.
     *
     * This is the deliberate credential-ROTATION path: when the dashboard changes
     * a database password it MUST persist the new value here (never into .env) so
     * config/database.php (which reads it via get()) and the .sh toolchain stay in
     * sync. Requires the process to have write access to the store (the Octane
     * runtime runs with that access); returns false on any failure.
     */
    public static function put(string $key, string $value): bool
    {
        $normalized = preg_replace('/[^A-Z0-9_]/', '', strtoupper($key));
        if ($normalized === '') {
            return false;
        }

        $dir = self::dir();
        if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
            return false;
        }

        $path = $dir . '/' . $normalized;
        if (@file_put_contents($path, $value . "\n") === false) {
            return false;
        }
        @chmod($path, 0600);

        return true;
    }
}
