<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TtsVariantSpecModel;
use App\Providers\PathMapper;

/**
 * Structured multi-variant word audio registry (mirror of sentence audio_files).
 *
 * Legacy tts_files[] entries are promoted into audio_files on first read.
 */
class AppQyV1WordAudioFiles
{
    public const SOURCE_TTS = 'tts';
    public const SOURCE_HUMAN = 'human';
    public const SOURCE_REAL = 'real';

    public const VOICE_MACHINE = 'machine';
    public const VOICE_NEURAL = 'neural';
    public const VOICE_HUMAN = 'human';

    /** @return array<int,array<string,mixed>> */
    public static function list(AppQyV1LangDictionaryModel $entry): array
    {
        $files = $entry->audio_files;
        if (!is_array($files)) {
            $files = [];
        }
        if ($files === []) {
            $legacy = $entry->tts_files;
            if (is_array($legacy) && $legacy !== []) {
                foreach ($legacy as $row) {
                    if (!is_array($row)) {
                        continue;
                    }
                    $path = $row['path'] ?? null;
                    if (!is_string($path) || $path === '') {
                        continue;
                    }
                    $files[] = self::normalizeEntry([
                        'variant_key' => '',
                        'accent' => $row['accent'] ?? null,
                        'gender' => $row['gender'] ?? null,
                        'source' => self::SOURCE_TTS,
                        'voice_type' => self::VOICE_MACHINE,
                        'provider' => (string) ($entry->tts_provider ?? ''),
                        'path' => $path,
                        'has_file' => self::pathOnDisk($path),
                    ]);
                }
            }
        }
        $out = [];
        foreach ($files as $row) {
            if (!is_array($row)) {
                continue;
            }
            $normalized = self::normalizeEntry($row);
            $path = (string) ($normalized['path'] ?? '');
            if ($path !== '') {
                $normalized['has_file'] = self::pathOnDisk($path);
            }
            $out[] = $normalized;
        }
        return $out;
    }

    /** @param array<string,mixed> $entry */
    public static function normalizeEntry(array $entry): array
    {
        $variantKey = (string) ($entry['variant_key'] ?? '');
        $accent = $entry['accent'] ?? null;
        $gender = $entry['gender'] ?? null;
        return [
            'variant_key' => $variantKey,
            'accent' => is_string($accent) && $accent !== '' ? $accent : null,
            'gender' => is_string($gender) && $gender !== '' ? $gender : null,
            'source' => (string) ($entry['source'] ?? self::SOURCE_TTS),
            'voice_type' => (string) ($entry['voice_type'] ?? self::VOICE_MACHINE),
            'provider' => (string) ($entry['provider'] ?? ''),
            'path' => (string) ($entry['path'] ?? ''),
            'has_file' => (bool) ($entry['has_file'] ?? false),
            'uploaded_at' => $entry['uploaded_at'] ?? null,
        ];
    }

    public static function findByVariantKey(AppQyV1LangDictionaryModel $entry, string $variantKey): ?array
    {
        foreach (self::list($entry) as $row) {
            if (($row['variant_key'] ?? '') === $variantKey) {
                return $row;
            }
        }
        return null;
    }

    public static function hasVariantWithFile(AppQyV1LangDictionaryModel $entry, string $variantKey): bool
    {
        $row = self::findByVariantKey($entry, $variantKey);
        return $row !== null && !empty($row['has_file']) && !empty($row['path']);
    }

    /**
     * Variant specs whose audio file is NOT on disk for this row (mirrors
     * AppQyV1SentenceAudioService::missingVariantsForRow). Used to re-claim a
     * word to fill additional accent/gender voices without clobbering existing
     * ones. The primary variant is missing when has_audio is false AND no
     * primary file is on disk.
     *
     * @return array<int,array{key:string,accent:?string,gender:string}>
     */
    public static function missingVariantsForRow(AppQyV1LangDictionaryModel $entry, string $lang): array
    {
        $missing = [];
        foreach (self::variantsForLanguage($lang) as $spec) {
            $key = (string) ($spec['key'] ?? '');
            if ($key === '') {
                if (empty($entry->has_audio) && !self::hasVariantWithFile($entry, '')) {
                    $missing[] = $spec;
                }
            } elseif (!self::hasVariantWithFile($entry, $key)) {
                $missing[] = $spec;
            }
        }
        return $missing;
    }

    /** @param array<string,mixed> $entry */
    public static function upsert(AppQyV1LangDictionaryModel $entry, array $entryRow): void
    {
        $normalized = self::normalizeEntry($entryRow);
        $key = (string) $normalized['variant_key'];
        $rows = [];
        $replaced = false;
        foreach (self::list($entry) as $row) {
            if (($row['variant_key'] ?? '') === $key) {
                $rows[] = $normalized;
                $replaced = true;
            } else {
                $rows[] = $row;
            }
        }
        if (!$replaced) {
            $rows[] = $normalized;
        }
        $entry->audio_files = $rows;
    }

    public static function pathOnDisk(string $relativePath): bool
    {
        if ($relativePath === '') {
            return false;
        }
        $full = rtrim(PathMapper::getAppQyV1AudioBaseDir(), '/\\') . '/' . ltrim($relativePath, '/');
        clearstatcache(true, $full);
        return is_file($full) && filesize($full) > 0;
    }

    /**
     * TTS variant specs per language. DB-driven via app_qy_v1_tts_variant_specs
     * and seeded at sys:init. Missing configuration is a runtime error so the
     * sentence and word audio paths share one authoritative model read path.
     *
     * @return array<int,array{key:string,accent:?string,gender:string}>
     */
    public static function variantsForLanguage(string $lang): array
    {
        return AppQyV1TtsVariantSpecModel::variantsForLanguage($lang);
    }
}
