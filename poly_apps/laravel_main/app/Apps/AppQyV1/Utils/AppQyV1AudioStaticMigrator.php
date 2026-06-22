<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\Utils;

use App\Providers\PathMapper;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

/**
 * One-time, idempotent COPY of legacy word/sentence-TTS audio into the unified
 * static tree.
 *
 * Phase 1 of the word-media pipeline moved the TTS audio base from
 *   <laravel_db>/tts_data/audio/{lang}/{type}/{file}        (EdgeTTS/AppQyV1TTS)
 *   <laravel_db>/external_data/audio/{lang}/{type}/{file}   (alt legacy root)
 * to the canonical unified location
 *   PathMapper::getAppQyV1AudioBaseDir() = <laravel_db>/static/app_qy_v1/audio/{lang}/{type}/{file}
 * so the write target equals the serve base and laravel_db copies cleanly.
 *
 * Stored tts_files relative paths ("{lang}/{type}/{file}") are UNCHANGED, so a
 * file already produced under a legacy base must be made readable under the new
 * base. This migrator COPIES every legacy audio file into the new tree at the
 * SAME relative path. It NEVER moves or deletes the legacy copies (data-safe),
 * NEVER overwrites a file already present in the new tree (fill-missing), and is
 * guarded by a sentinel so it runs once. Invoked from AppQyV1Initializer
 * (sys:init) alongside ensureDirectoryStructure / the external-data migrator.
 */
class AppQyV1AudioStaticMigrator
{
    private const GUARD_FILENAME = '.audio_static_migrated';

    /**
     * Legacy audio roots, drained (copied) into the new static base. Both keep
     * the identical "{lang}/{type}/{file}" relative layout, so the relative path
     * carried in tts_files stays valid after the copy.
     *
     * @return array<int, string> absolute legacy audio roots
     */
    private static function legacyRoots(): array
    {
        return [
            // EdgeTTSService / AppQyV1TTSService legacy base.
            rtrim(PathMapper::getLaravelDataDir(), '/\\') . DIRECTORY_SEPARATOR . 'tts_data' . DIRECTORY_SEPARATOR . 'audio',
            // Alternate legacy root some hosts wrote under.
            rtrim(PathMapper::getLaravelDataDir(), '/\\') . DIRECTORY_SEPARATOR . 'external_data' . DIRECTORY_SEPARATOR . 'audio',
        ];
    }

    /**
     * @return array{migrated:bool,copied:int,skipped:int,failed:int,reason:string}
     */
    public static function migrate(): array
    {
        $new = PathMapper::getAppQyV1AudioBaseDir();
        $guard = rtrim($new, '/\\') . DIRECTORY_SEPARATOR . self::GUARD_FILENAME;

        File::ensureDirectoryExists($new, 0755);

        // Idempotent short-circuit: already drained once.
        if (File::exists($guard)) {
            return ['migrated' => false, 'copied' => 0, 'skipped' => 0, 'failed' => 0, 'reason' => 'already_migrated'];
        }

        $newNorm = self::normalize($new);

        $copied = 0;
        $skipped = 0;
        $failures = [];

        foreach (self::legacyRoots() as $old) {
            if (!is_dir($old)) {
                continue;
            }

            $oldNorm = self::normalize($old);

            // Never recurse into / copy from the new tree itself (containment).
            if (self::samePath($oldNorm, $newNorm)
                || self::contains($oldNorm, $newNorm)
                || self::contains($newNorm, $oldNorm)) {
                continue;
            }

            foreach (File::allFiles($old) as $file) {
                $src = $file->getPathname();
                if (is_link($src)) {
                    continue;
                }

                $rel = ltrim(substr($src, strlen($old)), '/\\');
                if ($rel === '') {
                    continue;
                }

                $dst = rtrim($new, '/\\') . DIRECTORY_SEPARATOR . $rel;
                try {
                    if (File::exists($dst)) {
                        $skipped++;
                        continue;
                    }
                    File::ensureDirectoryExists(dirname($dst), 0755);
                    if (!File::copy($src, $dst)) {
                        $failures[] = $rel;
                        continue;
                    }
                    $copied++;
                } catch (\Throwable $e) {
                    $failures[] = $rel;
                }
            }
        }

        if (!empty($failures)) {
            Log::warning('[AppQyV1AudioStaticMigrator] partial copy; legacy kept, retry next boot', [
                'failed' => count($failures),
                'copied' => $copied,
                'skipped' => $skipped,
            ]);
            return ['migrated' => false, 'copied' => $copied, 'skipped' => $skipped, 'failed' => count($failures), 'reason' => 'partial_retry_next_boot'];
        }

        self::writeGuard($guard, $copied, $skipped);

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

    private static function writeGuard(string $guard, int $copied, int $skipped): void
    {
        try {
            File::put($guard, json_encode([
                'timestamp' => now()->toISOString(),
                'new_base' => PathMapper::getAppQyV1AudioBaseDir(),
                'legacy_roots' => self::legacyRoots(),
                'copied' => $copied,
                'skipped' => $skipped,
            ], JSON_PRETTY_PRINT));
        } catch (\Throwable $e) {
            // Non-fatal: a missing guard only means the (idempotent) scan runs again.
        }
    }
}
