<?php

namespace App\Http\Controllers;

use App\Providers\PathMapper;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Bare-Octane fallback for /static/*.
 *
 * In production nginx maps /static/ straight onto the external wwwroot static
 * directory (PathMapper::getStaticPath()) and Laravel never sees these
 * requests. Under bare Octane (local dev, no nginx) nothing served them, so
 * every generated asset URL (vocabulary covers /static/app_qy_v1/covers/*,
 * media clips, ...) 404'd. This controller serves the same directory with
 * conservative caching so both environments resolve the same URLs.
 */
class StaticFileController extends Controller
{
    private const CACHE_CONTROL = 'public, max-age=86400';

    /** Extension -> Content-Type map; anything unknown is octet-stream. */
    private const MIME_MAP = [
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'webp' => 'image/webp',
        'gif' => 'image/gif',
        'svg' => 'image/svg+xml',
        'mp3' => 'audio/mpeg',
        'wav' => 'audio/wav',
        'mp4' => 'video/mp4',
        'vtt' => 'text/vtt; charset=UTF-8',
        'srt' => 'text/plain; charset=UTF-8',
        'json' => 'application/json; charset=UTF-8',
        'txt' => 'text/plain; charset=UTF-8',
    ];

    public function serve(Request $request, string $path): Response
    {
        $baseDir = PathMapper::getStaticPath();
        $baseReal = realpath($baseDir);
        if ($baseReal === false) {
            abort(404);
        }

        $resolved = realpath(PathMapper::getStaticPath('/' . ltrim($path, '/')));
        if ($resolved === false || !is_file($resolved)) {
            abort(404);
        }

        // SECURITY: the resolved path must stay inside the static root -
        // realpath() has already collapsed any ../ or symlink indirection.
        $prefix = rtrim($baseReal, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
        if (!str_starts_with($resolved, $prefix)) {
            abort(403);
        }

        $size = filesize($resolved);
        $mtime = filemtime($resolved);
        $etag = '"' . md5($size . '|' . $mtime) . '"';

        $headers = [
            'Cache-Control' => self::CACHE_CONTROL,
            'ETag' => $etag,
        ];

        $ifNoneMatch = (string) $request->headers->get('If-None-Match', '');
        if ($ifNoneMatch !== '' && str_contains($ifNoneMatch, $etag)) {
            return response('', 304, $headers);
        }

        $extension = strtolower(pathinfo($resolved, PATHINFO_EXTENSION));
        $headers['Content-Type'] = self::MIME_MAP[$extension] ?? 'application/octet-stream';

        return response()->file($resolved, $headers);
    }
}
