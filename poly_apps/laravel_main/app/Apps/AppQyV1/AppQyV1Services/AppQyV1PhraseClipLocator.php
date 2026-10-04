<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Services\MediaIngestService;

/**
 * Batch file lookup of phrase clips for audio/lookup and audio/bundle (passive:
 * no row read, no queue write). Paths and URLs come from AppQyV1PhraseAudioService;
 * the file on disk is the truth and its modification time the clip version.
 */
final class AppQyV1PhraseClipLocator
{
    /** Content version of the phrase clip file (mtime in seconds), null when Laravel holds none. */
    public static function fileVersion(string $language, string $contentId): ?int
    {
        $path = AppQyV1PhraseAudioService::fullPathFor(AppQyV1PhraseAudioService::relativePathFor($language, $contentId));

        clearstatcache(true, $path);

        return is_file($path) && filesize($path) > 0 ? (int) filemtime($path) : null;
    }

    /**
     * @param array<int|string,array{text:string,language:string}> $items
     * @return array<int|string,array{content_id:string,language:string,exists:bool,url:?string,path:?string}> keys kept
     */
    public function resolvePassiveBatch(array $items): array
    {
        $results = [];

        foreach ($items as $key => $item) {
            $language = AppQyV1TableMaps::normalizeLangCode((string) $item['language']);
            $contentId = MediaIngestService::computeContentId((string) $item['text']);
            $relative = AppQyV1PhraseAudioService::relativePathFor($language, $contentId);
            $path = AppQyV1PhraseAudioService::fullPathFor($relative);
            clearstatcache(true, $path);
            $exists = is_file($path) && filesize($path) > 0;
            $results[$key] = [
                'content_id' => $contentId,
                'language' => $language,
                'exists' => $exists,
                'url' => $exists ? AppQyV1PhraseAudioService::urlFor($relative) : null,
                'path' => $exists ? $path : null,
            ];
        }

        return $results;
    }
}
