<?php

namespace App\Apps\AppQyV1\Utils\AppQyV1AITools;

/**
 * AppQyV1SentenceAudioUrl
 *
 * Single source of truth for the server-relative PUBLIC URL of a shared
 * sentence-library audio file.
 *
 * Storage (the source of truth) lives at
 *   PathMapper::getAppQyV1SentenceSoundsDir("{language}/{hash}.mp3")
 *   = <external_data>/audio/sentence_sounds/{language}/{hash}.mp3
 *
 * It is exposed under the same /static/ surface as every other generated
 * AppQyV1 asset (vocabulary covers serve at /static/app_qy_v1/covers/*,
 * media clips at /static/media/*). The dedicated serve route
 * GET /static/app_qy_v1/sentence_sounds/{language}/{filename}
 * (AppQyV1SentenceAudioController::serve) maps this URL back onto the
 * sentence_sounds dir, so the URL resolves identically under nginx
 * (production) and the bare-Octane StaticFileController (local dev).
 *
 * This builds a URL string, not a filesystem path, so it must NOT use
 * PathMapper. The relative reference stored on sentences.audio stays the bare
 * "{language}/{hash}.mp3"; this helper only prefixes the public route.
 */
final class AppQyV1SentenceAudioUrl
{
    /** Public serve-route prefix for shared sentence-library audio files. */
    public const PREFIX = '/static/app_qy_v1/sentence_sounds/';

    /**
     * Build the server-relative public URL for a "{language}/{hash}.ext"
     * sentence-audio relative path. The frontend prefixes the API origin.
     */
    public static function forRelative(string $relativePath): string
    {
        return self::PREFIX . ltrim($relativePath, '/');
    }
}
