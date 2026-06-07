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

namespace App\Apps\AppQyV1\Utils;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use App\Providers\PathMapper;

/**
 * One-time, idempotent migrator that drains the legacy external-data root
 * (storage_path('app/external_data')) into the canonical mapWebPath-backed
 * root (<www>/wwwroot/laravel_db/external_data).
 *
 * Behavior (per requirement): merge OLD into NEW skipping files that already
 * exist in NEW (never overwrite NEW), then delete the OLD directory once a
 * fully verified copy pass succeeds. Safe (OLD kept on any failure),
 * idempotent (guard file + per-file skip-if-exists), cross-OS (Laravel File +
 * PathMapper, in-process path normalization only).
 */
class AppQyV1ExternalDataMigrator
{
    private const GUARD_FILENAME = '.migrated_to_mapwebpath';

    /**
     * @return array{migrated:bool,copied:int,skipped:int,failed:int,reason:string}
     */
    public static function migrate(): array
    {
        $new = PathMapper::getAppQyV1ExternalDataRoot();
        $old = storage_path('app/external_data');
        $guard = rtrim($new, '/\\') . DIRECTORY_SEPARATOR . self::GUARD_FILENAME;

        $newNorm = self::normalize($new);
        $oldNorm = self::normalize($old);

        // (a) OLD and NEW resolve to the same location -> nothing to migrate.
        if (self::samePath($oldNorm, $newNorm)) {
            File::ensureDirectoryExists($new, 0755);
            self::writeGuard($guard, $old, $new, 0, 0);
            return ['migrated' => false, 'copied' => 0, 'skipped' => 0, 'failed' => 0, 'reason' => 'same_path'];
        }

        // (c) Already migrated and OLD gone -> idempotent short-circuit.
        if (File::exists($guard) && !is_dir($old)) {
            return ['migrated' => false, 'copied' => 0, 'skipped' => 0, 'failed' => 0, 'reason' => 'already_migrated'];
        }

        // (b) OLD absent -> fresh host; just mark done.
        if (!is_dir($old)) {
            File::ensureDirectoryExists($new, 0755);
            self::writeGuard($guard, $old, $new, 0, 0);
            return ['migrated' => false, 'copied' => 0, 'skipped' => 0, 'failed' => 0, 'reason' => 'old_absent'];
        }

        // (d) Containment violation -> never recurse into self / delete NEW.
        if (self::contains($oldNorm, $newNorm) || self::contains($newNorm, $oldNorm)) {
            Log::error('[AppQyV1ExternalDataMigrator] OLD/NEW nested; aborting', ['old' => $old, 'new' => $new]);
            return ['migrated' => false, 'copied' => 0, 'skipped' => 0, 'failed' => 0, 'reason' => 'nested_abort'];
        }

        File::ensureDirectoryExists($new, 0755);

        $copied = 0;
        $skipped = 0;
        $failures = [];

        foreach (File::allFiles($old) as $file) {
            $src = $file->getPathname();
            if (is_link($src)) {
                continue;
            }
            $rel = ltrim(substr($src, strlen($old)), '/\\');
            if ($rel === self::GUARD_FILENAME) {
                continue;
            }
            $dst = rtrim($new, '/\\') . DIRECTORY_SEPARATOR . $rel;
            try {
                File::ensureDirectoryExists(dirname($dst), 0755);
                if (File::exists($dst)) {
                    $skipped++;
                    continue;
                }
                if (!File::copy($src, $dst)) {
                    $failures[] = $rel;
                    continue;
                }
                $copied++;
            } catch (\Throwable $e) {
                $failures[] = $rel;
            }
        }

        if (!empty($failures)) {
            Log::warning('[AppQyV1ExternalDataMigrator] partial copy; OLD kept for retry', ['failed' => $failures]);
            return ['migrated' => false, 'copied' => $copied, 'skipped' => $skipped, 'failed' => count($failures), 'reason' => 'partial_retry_next_boot'];
        }

        // Verified pass (including copied==0 "NEW already had everything")
        // -> delete OLD per requirement.
        try {
            File::deleteDirectory($old);
        } catch (\Throwable $e) {
            Log::error('[AppQyV1ExternalDataMigrator] OLD delete failed; guard not written', ['err' => $e->getMessage()]);
            return ['migrated' => false, 'copied' => $copied, 'skipped' => $skipped, 'failed' => 0, 'reason' => 'delete_failed_retry'];
        }

        self::writeGuard($guard, $old, $new, $copied, $skipped);

        return ['migrated' => true, 'copied' => $copied, 'skipped' => $skipped, 'failed' => 0, 'reason' => 'ok'];
    }

    private static function normalize(string $path): string
    {
        $resolved = is_dir($path) ? realpath($path) : $path;
        if ($resolved === false) {
            $resolved = $path;
        }
        $resolved = str_replace('\\', '/', $resolved);
        return rtrim($resolved, '/');
    }

    private static function samePath(string $a, string $b): bool
    {
        return PathMapper::isWindows() ? strcasecmp($a, $b) === 0 : $a === $b;
    }

    private static function contains(string $parent, string $child): bool
    {
        $parentSlash = $parent . '/';
        $childSlash = $child . '/';
        if (PathMapper::isWindows()) {
            return stripos($childSlash, $parentSlash) === 0 && strcasecmp($parentSlash, $childSlash) !== 0;
        }
        return strpos($childSlash, $parentSlash) === 0 && $parentSlash !== $childSlash;
    }

    private static function writeGuard(string $guard, string $old, string $new, int $copied, int $skipped): void
    {
        try {
            File::put($guard, json_encode([
                'timestamp' => now()->toISOString(),
                'old' => $old,
                'new' => $new,
                'copied' => $copied,
                'skipped' => $skipped,
            ], JSON_PRETTY_PRINT));
        } catch (\Throwable $e) {
            // Non-fatal: a missing guard only means the (idempotent) scan runs again.
        }
    }
}
