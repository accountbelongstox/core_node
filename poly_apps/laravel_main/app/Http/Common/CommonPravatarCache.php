<?php

namespace App\Http\Common;

use App\Providers\PathMapper;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Response;

/**
 * Pravatar Cache Service
 *
 * Provides cached avatar images from https://i.pravatar.cc/150?u=xxx
 * Uses PHP map path for external cache storage
 */
class CommonPravatarCache
{
    private const PRAVATAR_API_BASE = 'https://i.pravatar.cc/150';
    private const CACHE_SUBDIR = 'pravatar_cache';
    private const DEFAULT_SIZE = 150;

    /**
     * Get avatar cache directory using PathMapper
     *
     * @return string Full path to cache directory
     */
    private static function getCacheDir(): string
    {
        // Use Laravel storage path for cache
        $basePath = storage_path('app/' . self::CACHE_SUBDIR);

        if (!file_exists($basePath)) {
            mkdir($basePath, 0755, true);
            Log::info('[CommonPravatarCache] Created cache directory', ['path' => $basePath]);
        }

        return $basePath;
    }

    /**
     * Get cached avatar filename based on name
     *
     * @param string $name User identifier (username, email, etc.)
     * @return string Filename for cache
     */
    private static function getCacheFilename(string $name): string
    {
        $safeName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $name);
        return 'avatar_' . md5($name) . '_' . substr($safeName, 0, 50) . '.png';
    }

    /**
     * Get cached avatar or fetch from pravatar.cc if not exists
     *
     * @param string $name User identifier
     * @param int $size Avatar size (default: 150)
     * @return array Response data with ['success' => bool, 'data' => mixed, 'path' => string]
     */
    public static function getAvatar(string $name, int $size = self::DEFAULT_SIZE): array
    {
        $cacheDir = self::getCacheDir();
        $filename = self::getCacheFilename($name);
        $cachePath = $cacheDir . '/' . $filename;

        // Check if cached file exists
        if (file_exists($cachePath)) {
            Log::info('[CommonPravatarCache] Serving from cache', [
                'name' => $name,
                'path' => $cachePath,
                'size' => filesize($cachePath)
            ]);

            return [
                'success' => true,
                'data' => file_get_contents($cachePath),
                'path' => $cachePath,
                'from_cache' => true,
            ];
        }

        // Fetch from pravatar.cc
        try {
            $url = self::PRAVATAR_API_BASE . '?u=' . urlencode($name) . '&size=' . $size;

            Log::info('[CommonPravatarCache] Fetching from pravatar.cc', [
                'name' => $name,
                'url' => $url,
            ]);

            $response = Http::timeout(10)->get($url);

            if (!$response->successful()) {
                Log::error('[CommonPravatarCache] Failed to fetch avatar', [
                    'status' => $response->status(),
                    'name' => $name,
                ]);

                return [
                    'success' => false,
                    'error' => 'Failed to fetch avatar from pravatar.cc',
                    'status_code' => $response->status(),
                ];
            }

            $imageData = $response->body();

            // Save to cache
            $saved = file_put_contents($cachePath, $imageData);

            if ($saved === false) {
                Log::error('[CommonPravatarCache] Failed to save cache file', [
                    'path' => $cachePath,
                ]);

                // Return the image data even if caching failed
                return [
                    'success' => true,
                    'data' => $imageData,
                    'from_cache' => false,
                    'cache_failed' => true,
                ];
            }

            Log::info('[CommonPravatarCache] Avatar fetched and cached', [
                'name' => $name,
                'path' => $cachePath,
                'size' => strlen($imageData),
            ]);

            return [
                'success' => true,
                'data' => $imageData,
                'path' => $cachePath,
                'from_cache' => false,
            ];

        } catch (\Exception $e) {
            Log::error('[CommonPravatarCache] Exception during avatar fetch', [
                'error' => $e->getMessage(),
                'name' => $name,
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get avatar and return as HTTP response
     *
     * @param string $name User identifier
     * @param int $size Avatar size
     * @return \Illuminate\Http\Response
     */
    public static function getAvatarResponse(string $name, int $size = self::DEFAULT_SIZE)
    {
        $result = self::getAvatar($name, $size);

        if (!$result['success']) {
            return Response::json([
                'error' => $result['error'] ?? 'Unknown error',
            ], $result['status_code'] ?? 500);
        }

        return Response::make($result['data'], 200, [
            'Content-Type' => 'image/png',
            'Cache-Control' => 'public, max-age=86400',
            'X-From-Cache' => $result['from_cache'] ? 'true' : 'false',
        ]);
    }

    /**
     * Clear cache for specific user
     *
     * @param string $name User identifier
     * @return bool Success
     */
    public static function clearCache(string $name): bool
    {
        $cacheDir = self::getCacheDir();
        $filename = self::getCacheFilename($name);
        $cachePath = $cacheDir . '/' . $filename;

        if (file_exists($cachePath)) {
            $deleted = unlink($cachePath);
            Log::info('[CommonPravatarCache] Cache cleared', [
                'name' => $name,
                'success' => $deleted,
            ]);
            return $deleted;
        }

        return false;
    }

    /**
     * Get cache statistics
     *
     * @return array Cache statistics
     */
    public static function getCacheStats(): array
    {
        $cacheDir = self::getCacheDir();
        $files = glob($cacheDir . '/avatar_*.png');
        $totalSize = 0;

        foreach ($files as $file) {
            if (file_exists($file)) {
                $totalSize += filesize($file);
            }
        }

        return [
            'cache_dir' => $cacheDir,
            'total_files' => count($files),
            'total_size' => $totalSize,
            'total_size_mb' => round($totalSize / 1024 / 1024, 2),
        ];
    }

    /**
     * Clear all cached avatars
     *
     * @return array Result with count of deleted files
     */
    public static function clearAllCache(): array
    {
        $cacheDir = self::getCacheDir();
        $files = glob($cacheDir . '/avatar_*.png');
        $deleted = 0;

        foreach ($files as $file) {
            if (file_exists($file) && unlink($file)) {
                $deleted++;
            }
        }

        Log::info('[CommonPravatarCache] All cache cleared', [
            'deleted' => $deleted,
        ]);

        return [
            'success' => true,
            'deleted_count' => $deleted,
        ];
    }
}
