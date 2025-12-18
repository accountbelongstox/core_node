<?php

namespace App\Http\Controllers;

use App\Services\FileService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
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

        $headers = [
            'Content-Type' => $mimeType,
            'Cache-Control' => 'public, max-age=31536000',
        ];

        return response()->file($filePath, $headers);
    }
}
