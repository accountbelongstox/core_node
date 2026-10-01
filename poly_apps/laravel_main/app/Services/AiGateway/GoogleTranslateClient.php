<?php

namespace App\Services\AiGateway;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Google translation as a keyless remote call made by Laravel itself
 * (LARAVEL_GUIDE §1 AI gateway: remote work never becomes a pycore task).
 *
 * Items keep the shape pycore's translator returned, so callers are unchanged:
 * {original_text, translated_text, src_lang, dest_lang, pronunciation, from_cache, error}.
 */
final class GoogleTranslateClient
{
    /** Primary endpoint (translation + romanization). */
    private const ENDPOINT = 'https://translate.googleapis.com/translate_a/single';
    private const CLIENT = 'gtx';
    /** Fallback endpoint when the primary throttles this host (translation only). */
    private const FALLBACK_ENDPOINT = 'https://clients5.google.com/translate_a/t';
    private const FALLBACK_CLIENT = 'dict-chrome-ex';
    private const AUTO_LANGUAGE = 'auto';
    private const TIMEOUT_SECONDS = 15;
    private const CACHE_PREFIX = 'google_translate:';
    private const CACHE_DAYS = 30;
    /** Region-qualified codes Google expects in upper case after the dash. */
    private const REGION_SEPARATOR = '-';

    public static function translate(string $text, string $sourceLanguage, string $targetLanguage, bool $useCache = true): array
    {
        $source = self::languageCode($sourceLanguage !== '' ? $sourceLanguage : self::AUTO_LANGUAGE);
        $target = self::languageCode($targetLanguage);
        $cacheKey = self::CACHE_PREFIX.sha1($source.'|'.$target.'|'.$text);
        $cached = $useCache ? Cache::get($cacheKey) : null;
        $item = null;

        if (is_array($cached)) {
            return ['from_cache' => true] + $cached;
        }
        $item = self::primary($text, $source, $target) ?? self::fallback($text, $source, $target);
        if ($item === null) {
            return self::failure($text, $source, $target, __('pycore.google_translate_unavailable'));
        }
        if ($useCache && $item['translated_text'] !== '') {
            Cache::put($cacheKey, $item, now()->addDays(self::CACHE_DAYS));
        }

        return $item;
    }

    /** @return array<int, array<int, array>> [text index][target index] => item */
    public static function translateBatch(array $texts, string $sourceLanguage, array $targetLanguages, bool $useCache = true): array
    {
        $results = [];

        foreach (array_values($texts) as $textIndex => $text) {
            foreach (array_values($targetLanguages) as $targetLanguage) {
                $results[$textIndex][] = self::translate((string) $text, $sourceLanguage, (string) $targetLanguage, $useCache);
            }
        }

        return $results;
    }

    private static function primary(string $text, string $source, string $target): ?array
    {
        $query = http_build_query(['client' => self::CLIENT, 'sl' => $source, 'tl' => $target, 'q' => $text], '', '&', PHP_QUERY_RFC3986);
        $response = null;
        $data = null;

        try {
            $response = Http::timeout(self::TIMEOUT_SECONDS)->get(self::ENDPOINT.'?'.$query.'&dt=t&dt=rm');
        } catch (ConnectionException) {
            return null;
        }
        $data = $response->successful() ? $response->json() : null;
        if (!is_array($data) || !is_array($data[0] ?? null)) {
            return null;
        }

        return self::item($text, is_string($data[2] ?? null) ? $data[2] : $source, $target, self::joinSegments($data[0], 0), self::pronunciation($data[0]));
    }

    private static function fallback(string $text, string $source, string $target): ?array
    {
        $response = null;
        $entry = null;

        try {
            $response = Http::timeout(self::TIMEOUT_SECONDS)->get(self::FALLBACK_ENDPOINT, [
                'client' => self::FALLBACK_CLIENT,
                'sl' => $source,
                'tl' => $target,
                'q' => $text,
            ]);
        } catch (ConnectionException) {
            return null;
        }
        $entry = $response->successful() ? ($response->json()[0] ?? null) : null;
        if (is_string($entry)) {
            return self::item($text, $source, $target, trim($entry), null);
        }

        return is_array($entry) && is_string($entry[0] ?? null)
            ? self::item($text, is_string($entry[1] ?? null) ? $entry[1] : $source, $target, trim($entry[0]), null)
            : null;
    }

    private static function item(string $text, string $source, string $target, string $translation, ?string $pronunciation): ?array
    {
        return $translation === '' ? null : [
            'original_text' => $text,
            'translated_text' => $translation,
            'src_lang' => $source,
            'dest_lang' => $target,
            'pronunciation' => $pronunciation,
            'from_cache' => false,
            'error' => null,
        ];
    }

    private static function joinSegments(array $segments, int $index): string
    {
        $parts = [];

        foreach ($segments as $segment) {
            if (is_array($segment) && is_string($segment[$index] ?? null)) {
                $parts[] = $segment[$index];
            }
        }

        return trim(implode('', $parts));
    }

    /** Target-language romanization row (dt=rm): [null, null, target_translit, source_translit]. */
    private static function pronunciation(array $segments): ?string
    {
        foreach ($segments as $segment) {
            if (is_array($segment) && ($segment[0] ?? null) === null && is_string($segment[2] ?? null) && $segment[2] !== '') {
                return $segment[2];
            }
        }

        return null;
    }

    private static function languageCode(string $language): string
    {
        $parts = explode(self::REGION_SEPARATOR, strtolower(trim($language)), 2);

        return isset($parts[1]) ? $parts[0].self::REGION_SEPARATOR.strtoupper($parts[1]) : $parts[0];
    }

    private static function failure(string $text, string $source, string $target, string $error): array
    {
        return [
            'success' => false,
            'original_text' => $text,
            'translated_text' => '',
            'src_lang' => $source,
            'dest_lang' => $target,
            'pronunciation' => null,
            'from_cache' => false,
            'error' => $error,
        ];
    }

    private function __construct()
    {
    }
}
