<?php

use Illuminate\Support\Facades\Route;
use App\Providers\PathMapper;

/*
|--------------------------------------------------------------------------
| File Access Routes
|--------------------------------------------------------------------------
|
| Unified file access system using PathMapper
|
*/

Route::get('/files/avatars/{app}/{filename}', function (string $app, string $filename) {
    $avatarsDir = PathMapper::getLaravelAvatarsDir();
    $filePath = $avatarsDir . '/' . $app . '/' . $filename;

    if (!file_exists($filePath)) {
        abort(404);
    }

    $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

    $mimeTypes = [
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        'svg' => 'image/svg+xml',
    ];

    $mimeType = 'application/octet-stream';
    if (isset($mimeTypes[$extension])) {
        $mimeType = $mimeTypes[$extension];
    }

    return response()->file($filePath, [
        'Content-Type' => $mimeType,
        'Cache-Control' => 'public, max-age=31536000',
    ]);
})->where(['app' => '[a-zA-Z0-9_-]+', 'filename' => '[a-zA-Z0-9_.-]+']);

Route::get('/files/uploads/{app}/{filename}', function (string $app, string $filename) {
    $uploadsDir = PathMapper::getLaravelUploadsDir();
    $filePath = $uploadsDir . '/' . $app . '/' . $filename;

    if (!file_exists($filePath)) {
        abort(404);
    }

    return response()->download($filePath);
})->where(['app' => '[a-zA-Z0-9_-]+', 'filename' => '[a-zA-Z0-9_.-]+']);
