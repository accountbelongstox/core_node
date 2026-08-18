<?php

namespace App\Apps\AppQyV1\Utils\AppQyV1AITools;

/**
 * AppQyV1ImageUrl
 *
 * Single source of truth for the server-relative PUBLIC URL of a word image
 * stored in tts_cache_{lang}.image_files. Mirrors AppQyV1SentenceAudioUrl.
 *
 * Bing-assist images are BINARY: the chrome side captures the image bytes
 * in-page (the Bing image URLs are not fetchable server-side) and submits
 * base64; the backend stores them as LOCAL files under
 *   PathMapper::getAppQyV1WordImagesDir("{lang}/word/{md5}.{ext}")
 * and writes the bare relative path "{lang}/word/{md5}.{ext}" into image_files.
 * The dedicated serve route
 *   GET /static/app_qy_v1/word_images/{path}
 * (AppQyV1WordImageController::serve) maps the public URL back onto that dir, so
 * it resolves identically under nginx (production) and the bare-Octane
 * StaticFileController (local dev). The FE prefixes the API origin.
 *
 * An absolute http(s):// (or protocol-relative //) value is passed through
 * UNCHANGED as a defensive fallback for any legacy external entry — Bing does
 * not use this path anymore (no server-side image-URL fetch anywhere).
 *
 * This builds a URL string, not a filesystem path, so it must NOT use PathMapper.
 * An image_files entry may be a bare string OR an array carrying `url`/`path`.
 */
final class AppQyV1ImageUrl
{
    /** Public serve-route prefix for local word-image files. */
    public const PREFIX = '/static/app_qy_v1/word_images/';

    /**
     * Build a usable URL for a single image_files entry.
     *
     * @param mixed $entry  A string (relative path | url) or an array with `url`/`path`.
     * @return string|null  The resolved URL, or null when the entry is empty.
     */
    public static function forEntry($entry): ?string
    {
        $raw = self::rawValue($entry);
        if ($raw === null || $raw === '') {
            return null;
        }
        return self::forPath($raw);
    }

    /**
     * Resolve a single raw value: a stored LOCAL relative path
     * ("{lang}/word/{md5}.{ext}") gets the word-image serve-route prefix; an
     * already-absolute serve URL (starts with "/") and external http(s):// (or
     * "//") URLs pass through unchanged (defensive fallback).
     */
    public static function forPath(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return $value;
        }

        // External absolute URL — defensive pass-through (Bing no longer uses this).
        if (preg_match('#^https?://#i', $value) === 1) {
            return $value;
        }
        // Protocol-relative URL — pass through.
        if (str_starts_with($value, '//')) {
            return $value;
        }
        // Already a server-relative serve URL — pass through.
        if (str_starts_with($value, '/')) {
            return $value;
        }

        // Local relative path -> word-image serve route.
        return self::PREFIX . ltrim($value, '/');
    }

    /**
     * Map a whole image_files array into the FE contract: a list of { url }.
     * Each entry may be a bare string or an array with `url`/`path`; empty/
     * unresolvable entries are dropped.
     *
     * @param mixed $imageFiles  The decoded image_files column (array or null).
     * @return array<int, array{url:string}>
     */
    public static function listFrom($imageFiles): array
    {
        if (!is_array($imageFiles)) {
            return [];
        }

        $out = [];
        foreach ($imageFiles as $entry) {
            $url = self::forEntry($entry);
            if ($url !== null && $url !== '') {
                $out[] = ['url' => $url];
            }
        }
        return $out;
    }

    /**
     * Extract the raw url/path string from a heterogeneous image_files entry.
     */
    private static function rawValue($entry): ?string
    {
        if (is_string($entry)) {
            return $entry;
        }
        if (is_array($entry)) {
            if (isset($entry['path']) && is_string($entry['path']) && $entry['path'] !== '') {
                return $entry['path'];
            }
            if (isset($entry['url']) && is_string($entry['url']) && $entry['url'] !== '') {
                return $entry['url'];
            }
        }
        return null;
    }
}
