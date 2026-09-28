<?php

namespace App\Apps\AppQyV1\Utils\AppQyV1AITools;

/**
 * AppQyV1TtsUrl
 *
 * Single source of truth for building the server-relative TTS audio URL.
 *
 * The canonical audio URL is the AppQyV1 serve route prefix plus the relative
 * audio path (the tts_files[].path value, e.g. "en/word/<hash>.mp3" or
 * "en/word/p0pct/<hash>.mp3"). This builds a URL string, not a filesystem
 * path, so it must NOT use PathMapper. The frontend prefixes the origin.
 */
final class AppQyV1TtsUrl
{
    /**
     * Canonical serve route prefix for AppQyV1 TTS audio files.
     */
    private const PREFIX = '/api/app_qy_v1/ai_tools/tts/audio/';

    /**
     * Build the canonical server-relative audio URL for a relative path.
     */
    public static function forPath(string $relativePath): string
    {
        return self::PREFIX . ltrim($relativePath, '/');
    }
}
