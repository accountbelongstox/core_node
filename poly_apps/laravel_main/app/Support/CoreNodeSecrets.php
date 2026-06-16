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
     * Ordered list of store directories to read from. The bash toolchain
     * (gvar_common.sh) ALWAYS writes to the canonical /var/_core_node/global_var
     * (it hardcodes CORE_NODE_DATA_DIR=/var/_core_node), whereas dir() honors an
     * inherited CORE_NODE_DATA_DIR override. When the override points somewhere
     * the writer never used, the env dir is empty and the secret looks "missing"
     * (symptom: PostgreSQL "fe_sendauth: no password supplied" at migrate time on
     * a server where the env var is set, while WSL/desktop with the var unset works).
     * Reading the env dir FIRST (honor an explicit override) then the canonical dir
     * makes the reader cross-environment robust regardless of the env var. Deduped,
     * order preserved.
     */
    private static function candidateDirs(): array
    {
        $dirs = [];

        // 1) The app's OWN data dir mirror. Always inside open_basedir and resolved
        //    per-OS by the path mapper, so it is readable even when /var/_core_node is
        //    NOT (panel-style servers lock PHP to /www/wwwroot/<site>). The shell
        //    toolchain (46_install_postgresql.sh) writes the PG password here too.
        try {
            if (class_exists(\App\Providers\PathMapper::class)) {
                $dirs[] = \App\Providers\PathMapper::mapWebPath('laravel_data_dir', '.core_node_secrets');
            }
        } catch (\Throwable $e) {
            // PathMapper unavailable (early boot) -> skip; fall through to the rest.
        }

        // 2) The env-configured store dir (honors an explicit CORE_NODE_DATA_DIR).
        // 3) The canonical /var location the bash writer always uses.
        $dirs[] = self::dir();
        $dirs[] = '/var/_core_node/global_var';

        return array_values(array_unique(array_filter($dirs)));
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

        // Try the env-configured dir first (honors an explicit CORE_NODE_DATA_DIR
        // override), then the canonical /var/_core_node the bash writer always uses.
        foreach (self::candidateDirs() as $dir) {
            $path = $dir . '/' . $normalized;
            if (!is_file($path) || !is_readable($path)) {
                continue;
            }

            $value = @file_get_contents($path);
            if ($value === false) {
                continue;
            }

            $value = trim($value);
            if ($value !== '') {
                return $value;
            }
        }

        return $default;
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
