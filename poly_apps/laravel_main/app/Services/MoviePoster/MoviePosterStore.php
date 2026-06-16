<?php

namespace App\Services\MoviePoster;

use App\Providers\PathMapper;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

/**
 * Movie/TV Poster Store.
 *
 * Canonical contract: development-guides/MOVIE_POSTER_PIPELINE.md §5.
 *
 * Validates poster bytes, writes them to a LOCAL file under
 *   PathMapper::getStaticPath().'/app_qy_v1/posters/<source_key>.<ext>'
 * (served by the existing /static/{path} fallback route + StaticFileController),
 * and sets the poster_* columns on a Book / Subtitle model.
 *
 * Fill-missing / idempotent: a row already poster_status='ready' is NEVER
 * clobbered. Decoding a pycore ingest `poster` payload (base64) routes through
 * the same applyToModel() path.
 */
class MoviePosterStore
{
    private const URL_PREFIX = '/static/app_qy_v1/posters';
    private const SUBDIR = 'app_qy_v1/posters';

    /**
     * Public URL for a stored poster filename.
     */
    public function buildPosterUrl(string $filename): string
    {
        return url(self::URL_PREFIX . '/' . ltrim($filename, '/'));
    }

    /**
     * Absolute on-disk directory for posters (created if missing).
     */
    public function postersDir(): string
    {
        $dir = PathMapper::getStaticPath(self::SUBDIR);
        PathMapper::ensureDirectory($dir);
        return $dir;
    }

    /**
     * Apply a poster result (from MoviePosterClient or a decoded ingest payload)
     * to a media model: validate bytes, write the file, set the poster_* columns
     * with poster_status='ready'. Fill-missing — a model already 'ready' is left
     * untouched.
     *
     * @param Model $model         Book or Subtitle (must expose source_key).
     * @param array $posterResult  ['provider','source_id','binary','mime','meta']
     * @return array{ok:bool,status:string,already_done?:bool,error?:string,image_url?:string}
     */
    public function applyToModel(Model $model, array $posterResult): array
    {
        $sourceKey = (string) $model->getAttribute('source_key');
        if ($sourceKey === '') {
            return ['ok' => false, 'status' => 'failed', 'error' => 'model has no source_key'];
        }

        // Fill-missing: never clobber a row already ready with a file present.
        if ($model->getAttribute('poster_status') === 'ready') {
            $existing = (string) $model->getAttribute('poster_filename');
            if ($existing !== '' && File::exists($this->posterPath($existing))) {
                return [
                    'ok' => true,
                    'status' => 'ready',
                    'already_done' => true,
                    'image_url' => $this->buildPosterUrl($existing),
                ];
            }
        }

        $binary = (string) ($posterResult['binary'] ?? '');
        if ($binary === '' || !self::looksLikeImage($binary)) {
            return ['ok' => false, 'status' => 'failed', 'error' => 'poster bytes failed image validation'];
        }

        $mime = (string) ($posterResult['mime'] ?? 'image/jpeg');
        $ext = $this->extForMime($mime, $binary);
        $filename = $sourceKey . '.' . $ext;
        $path = $this->posterPath($filename);

        try {
            $written = File::put($path, $binary);
        } catch (\Throwable $e) {
            $written = false;
            Log::warning('[MoviePoster] Failed to write poster file', ['path' => $path, 'error' => $e->getMessage()]);
        }

        if ($written === false) {
            return ['ok' => false, 'status' => 'failed', 'error' => 'failed to write poster file'];
        }

        $model->setAttribute('poster_filename', $filename);
        $model->setAttribute('poster_provider', (string) ($posterResult['provider'] ?? null) ?: null);
        $model->setAttribute('poster_source_id', (string) ($posterResult['source_id'] ?? null) ?: null);
        $model->setAttribute('poster_status', 'ready');
        $model->setAttribute('poster_meta', is_array($posterResult['meta'] ?? null) ? $posterResult['meta'] : null);
        $model->setAttribute('poster_fetched_at', now());
        $model->save();

        return [
            'ok' => true,
            'status' => 'ready',
            'image_url' => $this->buildPosterUrl($filename),
        ];
    }

    /**
     * Decode a pycore ingest `poster` payload (base64) into a poster result and
     * apply it to the model. Used by MediaIngestService when source.poster is
     * present. Never throws; returns the same shape as applyToModel().
     *
     * @param array $poster ['provider','source_id','mime','image_base64','meta']
     */
    public function applyIngestPayload(Model $model, array $poster): array
    {
        $base64 = (string) ($poster['image_base64'] ?? '');
        if ($base64 === '') {
            return ['ok' => false, 'status' => 'failed', 'error' => 'poster.image_base64 is empty'];
        }

        $binary = base64_decode($base64, true);
        if ($binary === false || $binary === '') {
            return ['ok' => false, 'status' => 'failed', 'error' => 'poster.image_base64 is not valid base64'];
        }

        return $this->applyToModel($model, [
            'provider' => $poster['provider'] ?? null,
            'source_id' => $poster['source_id'] ?? null,
            'binary' => $binary,
            'mime' => $poster['mime'] ?? 'image/jpeg',
            'meta' => is_array($poster['meta'] ?? null) ? $poster['meta'] : [],
        ]);
    }

    /**
     * Public image_url for a model when its poster is ready, else null.
     */
    public function imageUrlFor(Model $model): ?string
    {
        if ($model->getAttribute('poster_status') !== 'ready') {
            return null;
        }
        $filename = (string) $model->getAttribute('poster_filename');
        if ($filename === '') {
            return null;
        }
        return $this->buildPosterUrl($filename);
    }

    /**
     * Absolute path for a poster filename (dir ensured).
     */
    private function posterPath(string $filename): string
    {
        return rtrim($this->postersDir(), '/\\') . DIRECTORY_SEPARATOR . ltrim($filename, '/\\');
    }

    /**
     * File extension for a MIME / magic bytes (defaults to jpg).
     */
    private function extForMime(string $mime, string $binary): string
    {
        $mime = strtolower(trim($mime));
        if ($mime === 'image/png' || str_starts_with($binary, "\x89PNG\r\n\x1a\n")) {
            return 'png';
        }
        if ($mime === 'image/webp' || (str_starts_with($binary, 'RIFF') && substr($binary, 8, 4) === 'WEBP')) {
            return 'webp';
        }
        if ($mime === 'image/gif' || str_starts_with($binary, 'GIF8')) {
            return 'gif';
        }
        return 'jpg';
    }

    /**
     * Image sniffing: PNG / JPEG / WebP (RIFF) / GIF magic bytes. Mirrors
     * AppQyV1AssistService::looksLikeImage (cover storage validation).
     */
    public static function looksLikeImage(string $bytes): bool
    {
        if (strlen($bytes) < 12) {
            return false;
        }

        return str_starts_with($bytes, "\x89PNG\r\n\x1a\n")
            || str_starts_with($bytes, "\xFF\xD8\xFF")
            || (str_starts_with($bytes, 'RIFF') && substr($bytes, 8, 4) === 'WEBP')
            || str_starts_with($bytes, 'GIF87a')
            || str_starts_with($bytes, 'GIF89a');
    }
}
