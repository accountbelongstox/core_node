<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Models\LangSentence;

/**
 * Structured multi-variant sentence audio registry (Books v3.1).
 *
 * Each sentence row may carry several audio clips keyed by variant_key:
 *   - primary (variant_key "")     → {lang}/{content_id}.mp3
 *   - uk_f, us_m                   → edge-tts worker variants
 *   - duoreader_tts                → Duoreader API machine TTS
 *   - human_* / ai_*               → future human / AI captures
 *
 * Flexible string fields (source, voice_type, provider, accent) — no enum lock-in.
 *
 * FUTURE EXTENSIONS (not implemented — extend when a product surface needs them):
 * 1. Public read API — AppQyV1MediaContentPublicController::resolveSlotLanguages()
 *    should expose audio_files[] per language (not only primary audio path) so the
 *    FE can pick by accent / variant_key.
 * 2. Playback resolve — GET /api/app_qy_v1/ai_tools/tts/sentence/audio should accept
 *    ?variant_key=uk_f or ?accent=uk; AppQyV1SentenceAudioService::resolve() must
 *    stat the suffixed path via relativePathFor(), not primary-only findOnDisk().
 * 3. TTS worker claim — claim() / claimForLanguage() filter has_audio=false today;
 *    switch to missing entries in audio_files (per variantsForLanguage spec) so a
 *    sentence with duoreader_tts but no uk_f remains claimable for edge-tts.
 * 4. UK English upload — same content_id, POST /media/audio with variant_key=uk_f,
 *    accent=uk, provider=edge-tts, source=tts (see VARIANT_UK_F below).
 */
class AppQyV1SentenceAudioFiles
{
    public const SOURCE_TTS = 'tts';
    public const SOURCE_HUMAN = 'human';
    public const SOURCE_AI = 'ai';
    public const SOURCE_DUOREADER = 'duoreader';

    public const VOICE_MACHINE = 'machine';
    public const VOICE_NEURAL = 'neural';
    public const VOICE_HUMAN = 'human';

    public const VARIANT_DUOREADER_TTS = 'duoreader_tts';
    /** FUTURE: edge-tts UK female — upload via /media/audio with accent=uk. */
    public const VARIANT_UK_F = 'uk_f';
    /** FUTURE: edge-tts US male variant. */
    public const VARIANT_US_M = 'us_m';

    /** @return array<int,array<string,mixed>> */
    public static function list(LangSentence $sentence): array
    {
        $files = $sentence->audio_files;
        if (!is_array($files)) {
            $files = [];
        }
        if ($files === [] && is_array($sentence->metadata)) {
            $legacy = $sentence->metadata['audio_variants'] ?? null;
            if (is_array($legacy) && $legacy !== []) {
                foreach ($legacy as $key => $path) {
                    if (!is_string($key) || !is_string($path) || $path === '') {
                        continue;
                    }
                    $files[] = self::normalizeEntry([
                        'variant_key' => $key,
                        'source' => self::SOURCE_TTS,
                        'voice_type' => self::VOICE_MACHINE,
                        'provider' => (string) ($sentence->metadata['audio_provider'] ?? ''),
                        'path' => $path,
                        'has_file' => true,
                    ]);
                }
            }
        }
        $out = [];
        foreach ($files as $row) {
            if (!is_array($row)) {
                continue;
            }
            $out[] = self::normalizeEntry($row);
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

    public static function findByVariantKey(LangSentence $sentence, string $variantKey): ?array
    {
        foreach (self::list($sentence) as $row) {
            if (($row['variant_key'] ?? '') === $variantKey) {
                return $row;
            }
        }
        return null;
    }

    public static function hasVariantWithFile(LangSentence $sentence, string $variantKey): bool
    {
        $row = self::findByVariantKey($sentence, $variantKey);
        return $row !== null && !empty($row['has_file']) && !empty($row['path']);
    }

    /** @param array<string,mixed> $entry */
    public static function upsert(LangSentence $sentence, array $entry): void
    {
        $normalized = self::normalizeEntry($entry);
        $key = (string) $normalized['variant_key'];
        $rows = [];
        $replaced = false;
        foreach (self::list($sentence) as $row) {
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
        $sentence->audio_files = $rows;
    }
}
