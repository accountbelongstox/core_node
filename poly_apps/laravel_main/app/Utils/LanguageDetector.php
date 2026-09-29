<?php

namespace App\Utils;

/**
 * Lightweight, dependency-free language detector for short text (prompts).
 *
 * Distinguishes Chinese / English / Japanese / Korean by writing system, which
 * is the decisive signal for short prompts (statistical n-gram libraries need
 * sentence-length input and misclassify 1-2 word CJK). Generalizes the existing
 * in-repo Unicode-script technique used by BookTextStatsService.
 *
 * Returns 2-letter codes consistent with AppQyV1TranslationService::LANGUAGES.
 */
class LanguageDetector
{
    public const CODES = ['en', 'zh', 'ja', 'ko'];

    private const NAMES = [
        'en' => 'English',
        'zh' => 'Chinese',
        'ja' => 'Japanese',
        'ko' => 'Korean',
        'unknown' => 'Unknown',
    ];

    /**
     * Detect the dominant language code of a text.
     *
     * Priority (writing system is decisive):
     *   Hangul -> ko; any Kana -> ja (hard Japanese signal even when kanji-heavy);
     *   Han -> zh; Latin letter -> en; otherwise 'unknown'.
     *
     * @return string one of 'en'|'zh'|'ja'|'ko'|'unknown'
     */
    public static function detect(string $text): string
    {
        $text = trim($text);
        if ($text === '') {
            return 'unknown';
        }
        if (!mb_check_encoding($text, 'UTF-8')) {
            // Re-encode so the /u regexes below do not bail on malformed input.
            $text = mb_convert_encoding($text, 'UTF-8', 'UTF-8');
        }

        if (preg_match('/\p{Hangul}/u', $text) === 1) {
            return 'ko';
        }
        if (preg_match('/\p{Hiragana}|\p{Katakana}/u', $text) === 1) {
            return 'ja';
        }
        if (preg_match('/\p{Han}/u', $text) === 1) {
            return 'zh';
        }
        if (preg_match('/\p{Latin}/u', $text) === 1) {
            return 'en';
        }
        return 'unknown';
    }

    /**
     * True when the text is a translatable non-English language (zh/ja/ko).
     * 'unknown' (digits/symbols only) and 'en' both return false.
     */
    public static function isNonEnglish(string $text): bool
    {
        return in_array(self::detect($text), ['zh', 'ja', 'ko'], true);
    }

    /** Human-readable English name for a detected code. */
    public static function name(string $code): string
    {
        return self::NAMES[$code] ?? 'Unknown';
    }
}
