<?php

namespace App\Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleModel;
use App\Services\MoviePoster\MoviePosterStore;
use Illuminate\Database\Eloquent\Model;

class MediaBrowsePresenter
{
    private const CLIP_URL_BASE = '/api/app_qy_v1/media/clip';
    private const MIME_TYPES = [
        'mp4' => 'video/mp4',
        'mp3' => 'audio/mpeg',
        'm4a' => 'audio/mp4',
        'ogg' => 'audio/ogg',
        'opus' => 'audio/ogg',
        'webm' => 'video/webm',
        'srt' => 'text/plain',
    ];

    public function __construct(private readonly MoviePosterStore $posterStore)
    {
    }

    public function clipUrl(string $sourceKey, ?string $filename): ?string
    {
        $basename = '';

        if ($filename === null || $filename === '') {
            return null;
        }

        $basename = basename(str_replace('\\', '/', $filename));

        return $basename === ''
            ? null
            : self::CLIP_URL_BASE . '/' . $sourceKey . '/' . $basename;
    }

    public function articleAsSource(AppQyV1ArticleModel $article): object
    {
        return (object) [
            'source_key' => $article->article_id,
            'source_type' => 'article',
            'title' => $article->title,
            'original_name' => $article->title,
            'language' => $article->language,
            'word_count' => $article->word_count,
            'sentence_count' => $article->sentence_count,
            'metadata' => is_array($article->metadata) ? $article->metadata : [],
        ];
    }

    public function isValidSourceKey(string $sourceKey): bool
    {
        return $sourceKey !== '' && (bool) preg_match('/^[A-Za-z0-9._-]+$/', $sourceKey);
    }

    public function imageUrls(Model $model, ?string $posterUrl): array
    {
        $urls = [];
        $metadata = [];
        $unique = [];

        if (is_string($posterUrl) && $posterUrl !== '') {
            $urls[] = $posterUrl;
            $additionalCovers = $this->posterStore->additionalCovers($model);
            usort(
                $additionalCovers,
                static fn (array $left, array $right): int => strcmp(
                    (string) ($right['fetched_at'] ?? ''),
                    (string) ($left['fetched_at'] ?? '')
                )
            );
            foreach ($additionalCovers as $cover) {
                $filename = (string) ($cover['filename'] ?? '');
                if ($filename !== '') {
                    $urls[] = $this->posterStore->buildPosterUrl($filename);
                }
            }
        }

        $metadata = is_array($model->metadata ?? null) ? $model->metadata : [];
        if (!empty($metadata['cover_urls']) && is_array($metadata['cover_urls'])) {
            foreach ($metadata['cover_urls'] as $url) {
                if (is_string($url) && $url !== '') {
                    $urls[] = $url;
                }
            }
        } elseif (!empty($metadata['cover_url']) && is_string($metadata['cover_url'])) {
            $urls[] = $metadata['cover_url'];
        }

        $unique = array_values(array_unique($urls));

        return array_slice($unique, 0, MoviePosterStore::MAX_COVERS);
    }

    public function mimeType(string $name): string
    {
        $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));

        return self::MIME_TYPES[$extension] ?? 'application/octet-stream';
    }
}
