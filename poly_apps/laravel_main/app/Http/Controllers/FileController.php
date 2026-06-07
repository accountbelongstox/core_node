<?php

namespace App\Http\Controllers;

use App\Services\FileService;
use Illuminate\Http\Request;
// Supertype of BinaryFileResponse / StreamedResponse / JsonResponse /
// Illuminate\Http\Response, so response()->file()/download() type-check.
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Facades\Log;

/**
 * Unified File Controller - Handles all file access requests
 *
 * Uses FileService for validation and path resolution
 * Supports avatars, uploads, static files
 */
class FileController extends Controller
{
    /**
     * Serve avatar files
     *
     * @param string $app App name
     * @param string $filename Filename
     * @return Response
     */
    public function avatar(string $app, string $filename): Response
    {
        return $this->serveFile($app, $filename, 'avatar');
    }

    /**
     * Serve upload files
     *
     * @param string $app App name
     * @param string $filename Filename
     * @return Response
     */
    public function upload(string $app, string $filename): Response
    {
        return $this->serveFile($app, $filename, 'upload', true);
    }

    /**
     * Serve static files
     *
     * @param string $app App name
     * @param string $filename Filename
     * @return Response
     */
    public function static(string $app, string $filename): Response
    {
        return $this->serveFile($app, $filename, 'static');
    }

    /**
     * Generic file serving method
     *
     * @param string $app App name
     * @param string $filename Filename
     * @param string $fileType File type (avatar, upload, static)
     * @param bool $download Whether to force download
     * @return Response
     */
    protected function serveFile(string $app, string $filename, string $fileType, bool $download = false): Response
    {
        $validation = FileService::validateFileAccess($app, $filename, $fileType);

        if (!$validation['valid']) {
            Log::warning("[FileController] File access denied", [
                'app' => $app,
                'filename' => $filename,
                'type' => $fileType,
                'error' => $validation['error'],
            ]);

            abort(404);
        }

        $filePath = $validation['path'];

        if ($download) {
            return response()->download($filePath);
        }

        $mimeType = FileService::getMimeType($filename);

        // Avatars must always be served with an image Content-Type. If the
        // extension is unknown, fall back to image/png rather than
        // application/octet-stream so browsers render it inline.
        if ($fileType === 'avatar' && strpos($mimeType, 'image/') !== 0) {
            $mimeType = 'image/png';
        }

        $cacheControl = 'public, max-age=31536000';
        if ($fileType === 'avatar') {
            $cacheControl = 'public, max-age=86400';
        }

        $headers = [
            'Content-Type' => $mimeType,
            'Cache-Control' => $cacheControl,
        ];

        return response()->file($filePath, $headers);
    }
}
