<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1WordMediaService;
use App\Http\Controllers\Controller;
use App\Providers\PathMapper;
use Symfony\Component\HttpFoundation\Response;

/**
 * Word-image serve surface.
 *
 * Serves a Bing-assist word image stored as a LOCAL file under
 * PathMapper::getAppQyV1WordImagesDir() (written by
 * AppQyV1WordTranslationWriteback from submitted image_base64 bytes — the Bing
 * image URLs are not fetchable server-side, so images are binary-only).
 *
 * Mirrors AppQyV1SentenceAudioController::serve: the dedicated route
 *   GET /static/app_qy_v1/word_images/{path}
 * (registered in routes/static.php BEFORE the generic /static/{path} responder)
 * maps the public URL produced by AppQyV1ImageUrl back onto the word-images dir,
 * so it resolves identically under nginx (production) and bare-Octane (local dev).
 */
class AppQyV1WordImageController extends Controller
{
    private const CACHE_CONTROL = 'public, max-age=31536000';

    private const MIME_MAP = [
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
    ];

    /**
     * GET /static/app_qy_v1/word_images/{path}
     *
     * $path is the bare relative reference stored in image_files, e.g.
     * "en/word/<md5>.png". Path traversal is rejected and the resolved file must
     * stay inside the word-images root.
     */
    public function serve(string $path): Response
    {
        // Reject any path traversal before mapping.
        if (str_contains($path, '..') || str_contains($path, '\\') || str_starts_with($path, '/')) {
            abort(404);
        }

        $resolved = realpath(PathMapper::getAppQyV1WordImagesDir($path));
        if ($resolved === false || !is_file($resolved)) {
            abort(404);
        }

        // SECURITY: the resolved file must stay inside the word-images root.
        $baseReal = realpath(PathMapper::getAppQyV1WordImagesDir(''));
        if ($baseReal === false) {
            abort(404);
        }
        $prefix = rtrim($baseReal, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
        if (!str_starts_with($resolved, $prefix)) {
            abort(403);
        }

        $extension = strtolower(pathinfo($resolved, PATHINFO_EXTENSION));
        $contentType = self::MIME_MAP[$extension] ?? 'application/octet-stream';

        return response()->file($resolved, [
            'Content-Type' => $contentType,
            'Cache-Control' => self::CACHE_CONTROL,
        ]);
    }

    /**
     * SMART word-image serve: "request by word, not filename".
     *
     * GET /static/app_qy_v1/word_images/{lang}/{word}
     *
     * Resolves the word's canonical dictionary row (matched by md5(word)) and,
     * FILE-FIRST, 302-redirects to the resolved md5 file's stable serve URL when
     * an image is on disk. On a miss it enqueues the word + bumps a 'word_media'
     * task to the front (via AppQyV1WordMediaService) and returns a tiny 1x1
     * transparent PNG with HTTP 202 so an <img> tag degrades gracefully while the
     * real image is produced.
     *
     * The existing md5-path route GET /static/app_qy_v1/word_images/{path}
     * (serve() above) is unchanged and keeps winning the match for any path that
     * contains a "/" segment beyond {lang}/{word} or ends in a file extension.
     *
     * NOTE: {word} must NOT contain a slash (route constraint), so this never
     * shadows the md5 "{lang}/word/{md5}.{ext}" path.
     */
    public function serveByWord(string $lang, string $word): Response
    {
        $word = trim(urldecode($word));
        if ($word === '' || str_contains($word, '..') || str_contains($word, '/') || str_contains($word, '\\')) {
            return $this->pendingPixel();
        }

        $langCode = AppQyV1DictionaryService::getLanguageCode($lang);
        $row = AppQyV1LangDictionaryModel::findByMd5($langCode, md5($word));

        $service = new AppQyV1WordMediaService();

        if ($row) {
            $imageUrl = $service->resolveImageUrl($row);
            if ($imageUrl !== null) {
                // 302 to the stable md5 file URL (the {path} serve route / nginx).
                return redirect($imageUrl, 302);
            }
        }

        // Miss: enqueue + bump the word to the front, then return a placeholder.
        $service->bumpQueriedWord($row, $word, $langCode, null);

        return $this->pendingPixel();
    }

    /**
     * A 1x1 transparent PNG returned with HTTP 202 while the real image is being
     * produced (so a hot <img src> degrades gracefully and is never cached long).
     */
    private function pendingPixel(): Response
    {
        // 1x1 transparent PNG.
        $png = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        );

        return response($png, 202, [
            'Content-Type' => 'image/png',
            'Cache-Control' => 'no-store, max-age=0',
            'X-Word-Image-Status' => 'pending',
        ]);
    }
}
