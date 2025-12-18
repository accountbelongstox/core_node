<?php

namespace App\Services;

use App\Providers\PathMapper;
use Illuminate\Support\Facades\Log;

/**
 * Unified File Service - Centralized file URL generation and access
 *
 * Uses PathMapper to ensure consistent file system paths
 * Provides URL generation for all file types (avatars, uploads, static, etc.)
 */
class FileService
{
    /**
     * Supported file types and their storage directories
     */
    private const FILE_TYPES = [
        'avatar' => 'avatars',
        'upload' => 'uploads',
        'static' => 'static',
        'cache' => 'cache',
    ];

    /**
     * Get file URL for a given relative path
     *
     * @param string $relativePath Relative path like "avatars/appqyv1/avatar_1.png"
     * @param string $fileType File type (avatar, upload, static)
     * @return string|null Full URL or null
     */
    public static function getFileUrl(?string $relativePath, string $fileType = 'avatar'): ?string
    {
        if (!$relativePath) {
            return null;
        }

        if (filter_var($relativePath, FILTER_VALIDATE_URL)) {
            return $relativePath;
        }

        if (!isset(self::FILE_TYPES[$fileType])) {
            Log::warning("[FileService] Unknown file type: {$fileType}");
            return null;
        }

        $parts = explode('/', $relativePath);

        if (count($parts) < 2) {
            Log::warning("[FileService] Invalid relative path format: {$relativePath}");
            return null;
        }

        $expectedPrefix = self::FILE_TYPES[$fileType];
        if ($parts[0] !== $expectedPrefix) {
            Log::warning("[FileService] Path does not start with expected prefix '{$expectedPrefix}': {$relativePath}");
        }

        $app = $parts[1] ?? 'default';
        $filename = $parts[2] ?? basename($relativePath);

        return url("api/files/{$expectedPrefix}/{$app}/{$filename}");
    }

    /**
     * Get avatar URL
     *
     * @param string|null $relativePath Relative path like "avatars/appqyv1/avatar_1.png"
     * @return string|null Full URL or null
     */
    public static function getAvatarUrl(?string $relativePath): ?string
    {
        return self::getFileUrl($relativePath, 'avatar');
    }

    /**
     * Get upload file URL
     *
     * @param string|null $relativePath Relative path like "uploads/appqyv1/file.pdf"
     * @return string|null Full URL or null
     */
    public static function getUploadUrl(?string $relativePath): ?string
    {
        return self::getFileUrl($relativePath, 'upload');
    }

    /**
     * Get static file URL
     *
     * @param string|null $relativePath Relative path like "static/appqyv1/image.png"
     * @return string|null Full URL or null
     */
    public static function getStaticUrl(?string $relativePath): ?string
    {
        return self::getFileUrl($relativePath, 'static');
    }

    /**
     * Get full file system path for a relative path
     *
     * @param string $relativePath Relative path
     * @param string $fileType File type (avatar, upload, static)
     * @return string|null Full file system path or null
     */
    public static function getFilePath(string $relativePath, string $fileType = 'avatar'): ?string
    {
        $parts = explode('/', $relativePath);

        if (count($parts) < 3) {
            return null;
        }

        $baseDir = match($fileType) {
            'avatar' => PathMapper::getLaravelAvatarsDir(),
            'upload' => PathMapper::getLaravelUploadsDir(),
            'static' => PathMapper::getLaravelStaticDir(),
            'cache' => PathMapper::getLaravelCacheDir(),
            default => null,
        };

        if (!$baseDir) {
            return null;
        }

        $app = $parts[1];
        $filename = $parts[2];

        return $baseDir . '/' . $app . '/' . $filename;
    }

    /**
     * Check if file exists
     *
     * @param string $relativePath Relative path
     * @param string $fileType File type
     * @return bool
     */
    public static function fileExists(string $relativePath, string $fileType = 'avatar'): bool
    {
        $filePath = self::getFilePath($relativePath, $fileType);
        return $filePath && file_exists($filePath);
    }

    /**
     * Validate file access
     *
     * @param string $app App name
     * @param string $filename Filename
     * @param string $fileType File type
     * @return array{valid: bool, path: string|null, error: string|null}
     */
    public static function validateFileAccess(string $app, string $filename, string $fileType = 'avatar'): array
    {
        $app = preg_replace('/[^a-zA-Z0-9_-]/', '', $app);
        $filename = preg_replace('/[^a-zA-Z0-9_.-]/', '', $filename);

        if (empty($app) || empty($filename)) {
            return [
                'valid' => false,
                'path' => null,
                'error' => 'Invalid app or filename',
            ];
        }

        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        $allowedExtensions = match($fileType) {
            'avatar' => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
            'upload' => ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip', 'jpg', 'jpeg', 'png'],
            'static' => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'css', 'js', 'json'],
            default => [],
        };

        if (!in_array($extension, $allowedExtensions)) {
            return [
                'valid' => false,
                'path' => null,
                'error' => "File extension '{$extension}' not allowed for type '{$fileType}'",
            ];
        }

        $baseDir = match($fileType) {
            'avatar' => PathMapper::getLaravelAvatarsDir(),
            'upload' => PathMapper::getLaravelUploadsDir(),
            'static' => PathMapper::getLaravelStaticDir(),
            default => null,
        };

        if (!$baseDir) {
            return [
                'valid' => false,
                'path' => null,
                'error' => "Unknown file type: {$fileType}",
            ];
        }

        $filePath = $baseDir . '/' . $app . '/' . $filename;

        if (!file_exists($filePath)) {
            return [
                'valid' => false,
                'path' => null,
                'error' => 'File not found',
            ];
        }

        $realPath = realpath($filePath);
        $realBaseDir = realpath($baseDir);

        if (!$realPath || !$realBaseDir || !str_starts_with($realPath, $realBaseDir)) {
            return [
                'valid' => false,
                'path' => null,
                'error' => 'Invalid file path (security violation)',
            ];
        }

        return [
            'valid' => true,
            'path' => $filePath,
            'error' => null,
        ];
    }

    /**
     * Get MIME type for file
     *
     * @param string $filename Filename
     * @return string MIME type
     */
    public static function getMimeType(string $filename): string
    {
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        $mimeTypes = [
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'svg' => 'image/svg+xml',
            'pdf' => 'application/pdf',
            'doc' => 'application/msword',
            'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls' => 'application/vnd.ms-excel',
            'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'txt' => 'text/plain',
            'zip' => 'application/zip',
            'css' => 'text/css',
            'js' => 'application/javascript',
            'json' => 'application/json',
        ];

        return $mimeTypes[$extension] ?? 'application/octet-stream';
    }

    /**
     * Generate relative path for storage
     *
     * @param string $app App name
     * @param string $filename Filename
     * @param string $fileType File type
     * @return string Relative path
     */
    public static function generateRelativePath(string $app, string $filename, string $fileType = 'avatar'): string
    {
        $prefix = self::FILE_TYPES[$fileType] ?? 'files';
        return "{$prefix}/{$app}/{$filename}";
    }
}
