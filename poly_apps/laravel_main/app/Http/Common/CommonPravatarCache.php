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
    private const DEFAULT_SIZE = 512; // Default to maximum size
    private const MAX_CACHE_SIZE = 512; // Always cache at maximum resolution

    /**
     * Get avatar cache directory using PathMapper
     *
     * @return string Full path to cache directory
     */
    private static function getCacheDir(): string
    {
        // Use PathMapper laravel cache directory for external static file storage
        $basePath = PathMapper::getLaravelCacheDir() . '/avatars';

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
     * Always caches at maximum resolution (512x512) for keyword
     *
     * @param string $name User identifier
     * @return array Response data with ['success' => bool, 'data' => mixed, 'path' => string]
     */
    public static function getAvatar(string $name): array
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

        // Fetch from pravatar.cc at maximum resolution
        try {
            $url = self::PRAVATAR_API_BASE . '?u=' . urlencode($name) . '&size=' . self::MAX_CACHE_SIZE;

            Log::info('[CommonPravatarCache] Fetching from pravatar.cc', [
                'name' => $name,
                'url' => $url,
                'cache_size' => self::MAX_CACHE_SIZE,
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

            Log::info('[CommonPravatarCache] Avatar fetched and cached at max resolution', [
                'name' => $name,
                'path' => $cachePath,
                'size' => strlen($imageData),
                'resolution' => self::MAX_CACHE_SIZE . 'x' . self::MAX_CACHE_SIZE,
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
     * Resize image to specified dimensions
     *
     * @param string $imageData Original image binary data
     * @param int $targetSize Target size (square dimensions)
     * @return string|false Resized image binary data or false on failure
     */
    private static function resizeImage(string $imageData, int $targetSize)
    {
        try {
            // Create image from string
            $sourceImage = imagecreatefromstring($imageData);
            if ($sourceImage === false) {
                Log::error('[CommonPravatarCache] Failed to create image from string');
                return false;
            }

            // Get original dimensions
            $originalWidth = imagesx($sourceImage);
            $originalHeight = imagesy($sourceImage);

            // If already the correct size, return original
            if ($originalWidth === $targetSize && $originalHeight === $targetSize) {
                imagedestroy($sourceImage);
                return $imageData;
            }

            // Create new image at target size
            $targetImage = imagecreatetruecolor($targetSize, $targetSize);
            if ($targetImage === false) {
                imagedestroy($sourceImage);
                Log::error('[CommonPravatarCache] Failed to create target image');
                return false;
            }

            // Preserve transparency for PNG
            imagealphablending($targetImage, false);
            imagesavealpha($targetImage, true);

            // Resize using high-quality bicubic interpolation
            $resized = imagecopyresampled(
                $targetImage,
                $sourceImage,
                0, 0, 0, 0,
                $targetSize, $targetSize,
                $originalWidth, $originalHeight
            );

            if (!$resized) {
                imagedestroy($sourceImage);
                imagedestroy($targetImage);
                Log::error('[CommonPravatarCache] Failed to resize image');
                return false;
            }

            // Capture output to string
            ob_start();
            imagepng($targetImage, null, 9); // Max compression
            $resizedData = ob_get_clean();

            // Clean up
            imagedestroy($sourceImage);
            imagedestroy($targetImage);

            Log::info('[CommonPravatarCache] Image resized', [
                'from' => $originalWidth . 'x' . $originalHeight,
                'to' => $targetSize . 'x' . $targetSize,
                'original_size' => strlen($imageData),
                'resized_size' => strlen($resizedData),
            ]);

            return $resizedData;

        } catch (\Exception $e) {
            Log::error('[CommonPravatarCache] Exception during image resize', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return false;
        }
    }

    /**
     * Get avatar and return as HTTP response
     * Fetches from cache (512x512) and resizes to requested size
     *
     * @param string $name User identifier
     * @param int|null $size Avatar size (default: 512, returns full resolution)
     * @return \Illuminate\Http\Response
     */
    public static function getAvatarResponse(string $name, ?int $size = null)
    {
        // Default to max size if not specified
        $size = $size ?? self::DEFAULT_SIZE;

        // Store original requested size for header
        $requestedSize = $size;

        // Clamp size to valid range (1 to MAX_CACHE_SIZE)
        if ($size < 1) {
            $size = 1;
        } elseif ($size > self::MAX_CACHE_SIZE) {
            $size = self::MAX_CACHE_SIZE;
        }

        // Get avatar from cache (always 512x512)
        $result = self::getAvatar($name);

        if (!$result['success']) {
            return Response::json([
                'error' => $result['error'] ?? 'Unknown error',
            ], $result['status_code'] ?? 500);
        }

        $imageData = $result['data'];
        $fromCache = $result['from_cache'];

        // Resize if needed
        if ($size !== self::MAX_CACHE_SIZE) {
            $resizedData = self::resizeImage($imageData, $size);

            if ($resizedData === false) {
                // If resize fails, return original image
                Log::warning('[CommonPravatarCache] Resize failed, returning original', [
                    'name' => $name,
                    'requested_size' => $size,
                ]);
            } else {
                $imageData = $resizedData;
            }
        }

        // Prepare response headers
        $headers = [
            'Content-Type' => 'image/png',
            'Cache-Control' => 'public, max-age=86400',
            'X-From-Cache' => $fromCache ? 'true' : 'false',
            'X-Cached-Resolution' => self::MAX_CACHE_SIZE . 'x' . self::MAX_CACHE_SIZE,
            'X-Returned-Size' => $size . 'x' . $size,
        ];

        // Add warning header if size was clamped
        if ($requestedSize !== $size) {
            $headers['X-Size-Clamped'] = 'true';
            $headers['X-Requested-Size'] = $requestedSize . 'x' . $requestedSize;
        }

        return Response::make($imageData, 200, $headers);
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
