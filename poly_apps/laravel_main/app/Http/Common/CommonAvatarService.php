<?php

namespace App\Http\Common;

use App\Http\Common\AvatarProviders\AvatarProviderRegistry;
use App\Providers\PathMapper;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Response;

/**
 * Common Avatar Service
 *
 * Unified service for avatar caching and retrieval from multiple providers
 */
class CommonAvatarService
{
    private const CACHE_SUBDIR = 'avatars';
    private const DEFAULT_SIZE = 512;
    private const MAX_CACHE_SIZE = 512;

    /**
     * Get avatar cache directory
     */
    private static function getCacheDir(): string
    {
        $basePath = PathMapper::getLaravelCacheDir() . '/' . self::CACHE_SUBDIR;

        if (!file_exists($basePath)) {
            mkdir($basePath, 0755, true);
            Log::info('[CommonAvatarService] Created cache directory', ['path' => $basePath]);
        }

        return $basePath;
    }

    /**
     * Get cache filename based on seed and provider
     */
    private static function getCacheFilename(string $seed, string $providerCode): string
    {
        $safeSeed = preg_replace('/[^a-zA-Z0-9_-]/', '_', $seed);
        return 'avatar_' . md5($seed . '_' . $providerCode) . '_' . substr($safeSeed, 0, 30) . '_' . $providerCode . '.png';
    }

    /**
     * Check if a specific provider has cached avatar
     */
    private static function checkProviderCache(string $seed, string $providerCode): ?array
    {
        $cacheDir = self::getCacheDir();
        $filename = self::getCacheFilename($seed, $providerCode);
        $cachePath = $cacheDir . '/' . $filename;

        if (file_exists($cachePath)) {
            Log::info('[CommonAvatarService] Found cache', [
                'seed' => $seed,
                'provider' => $providerCode,
                'path' => $cachePath,
                'size' => filesize($cachePath)
            ]);

            return [
                'success' => true,
                'data' => file_get_contents($cachePath),
                'path' => $cachePath,
                'from_cache' => true,
                'provider' => $providerCode,
            ];
        }

        return null;
    }

    /**
     * Try to fetch avatar from a specific provider
     */
    private static function tryFetchFromProvider(string $seed, $provider): ?array
    {
        $providerCode = $provider->getShortCode();

        Log::info('[CommonAvatarService] Attempting to fetch from provider', [
            'seed' => $seed,
            'provider' => $providerCode,
        ]);

        // Fetch from provider at maximum resolution
        $result = $provider->fetchAvatar($seed, self::MAX_CACHE_SIZE);

        if (!$result['success']) {
            Log::warning('[CommonAvatarService] Provider fetch failed', [
                'seed' => $seed,
                'provider' => $providerCode,
                'error' => $result['error'] ?? 'Unknown error',
            ]);
            return null;
        }

        // Save to cache
        $cacheDir = self::getCacheDir();
        $filename = self::getCacheFilename($seed, $providerCode);
        $cachePath = $cacheDir . '/' . $filename;
        $saved = file_put_contents($cachePath, $result['data']);

        if ($saved === false) {
            Log::error('[CommonAvatarService] Failed to save cache file', [
                'path' => $cachePath,
            ]);

            return [
                'success' => true,
                'data' => $result['data'],
                'from_cache' => false,
                'cache_failed' => true,
                'provider' => $providerCode,
            ];
        }

        Log::info('[CommonAvatarService] Avatar fetched and cached', [
            'seed' => $seed,
            'provider' => $providerCode,
            'path' => $cachePath,
            'size' => strlen($result['data']),
            'resolution' => self::MAX_CACHE_SIZE . 'x' . self::MAX_CACHE_SIZE,
        ]);

        return [
            'success' => true,
            'data' => $result['data'],
            'path' => $cachePath,
            'from_cache' => false,
            'provider' => $providerCode,
        ];
    }

    /**
     * Get cached avatar or fetch from provider with fallback support
     */
    public static function getAvatar(string $seed, string|int|null $providerIdentifier = null): array
    {
        $requestedProvider = AvatarProviderRegistry::getProvider($providerIdentifier);
        $requestedProviderCode = $requestedProvider ? $requestedProvider->getShortCode() : null;

        // Step 1: Check requested provider cache first
        if ($requestedProvider) {
            $cached = self::checkProviderCache($seed, $requestedProvider->getShortCode());
            if ($cached) {
                $cached['requested_provider'] = $requestedProviderCode;
                $cached['fallback_used'] = false;
                return $cached;
            }
        }

        // Step 2: Try to fetch from requested provider
        if ($requestedProvider) {
            $fetched = self::tryFetchFromProvider($seed, $requestedProvider);
            if ($fetched) {
                $fetched['requested_provider'] = $requestedProviderCode;
                $fetched['fallback_used'] = false;
                return $fetched;
            }

            Log::warning('[CommonAvatarService] Requested provider failed, trying fallback', [
                'seed' => $seed,
                'requested_provider' => $requestedProviderCode,
            ]);
        }

        // Step 3: Check other providers' caches
        $allProviders = AvatarProviderRegistry::getAllProviders();
        foreach ($allProviders as $providerInfo) {
            $shortCode = $providerInfo['short_code'];

            // Skip the already-tried provider
            if ($requestedProviderCode && $shortCode === $requestedProviderCode) {
                continue;
            }

            $cached = self::checkProviderCache($seed, $shortCode);
            if ($cached) {
                Log::info('[CommonAvatarService] Using fallback cache', [
                    'seed' => $seed,
                    'requested_provider' => $requestedProviderCode ?? 'none',
                    'fallback_provider' => $shortCode,
                ]);

                $cached['requested_provider'] = $requestedProviderCode;
                $cached['fallback_used'] = true;
                return $cached;
            }
        }

        // Step 4: Try to fetch from other providers
        foreach ($allProviders as $providerInfo) {
            $shortCode = $providerInfo['short_code'];

            // Skip the already-tried provider
            if ($requestedProviderCode && $shortCode === $requestedProviderCode) {
                continue;
            }

            $provider = AvatarProviderRegistry::getProvider($shortCode);
            if (!$provider) {
                continue;
            }

            $fetched = self::tryFetchFromProvider($seed, $provider);
            if ($fetched) {
                Log::info('[CommonAvatarService] Using fallback provider', [
                    'seed' => $seed,
                    'requested_provider' => $requestedProviderCode ?? 'none',
                    'fallback_provider' => $shortCode,
                ]);

                $fetched['requested_provider'] = $requestedProviderCode;
                $fetched['fallback_used'] = true;
                return $fetched;
            }
        }

        // All providers failed
        Log::error('[CommonAvatarService] All providers failed', [
            'seed' => $seed,
            'requested_provider' => $requestedProviderCode ?? 'none',
        ]);

        return [
            'success' => false,
            'error' => 'All avatar providers failed',
            'requested_provider' => $requestedProviderCode,
        ];
    }

    /**
     * Resize image to specified dimensions
     */
    private static function resizeImage(string $imageData, int $targetSize)
    {
        try {
            $sourceImage = imagecreatefromstring($imageData);
            if ($sourceImage === false) {
                Log::error('[CommonAvatarService] Failed to create image from string');
                return false;
            }

            $originalWidth = imagesx($sourceImage);
            $originalHeight = imagesy($sourceImage);

            if ($originalWidth === $targetSize && $originalHeight === $targetSize) {
                imagedestroy($sourceImage);
                return $imageData;
            }

            $targetImage = imagecreatetruecolor($targetSize, $targetSize);
            if ($targetImage === false) {
                imagedestroy($sourceImage);
                return false;
            }

            imagealphablending($targetImage, false);
            imagesavealpha($targetImage, true);

            $resized = imagecopyresampled(
                $targetImage, $sourceImage,
                0, 0, 0, 0,
                $targetSize, $targetSize,
                $originalWidth, $originalHeight
            );

            if (!$resized) {
                imagedestroy($sourceImage);
                imagedestroy($targetImage);
                return false;
            }

            ob_start();
            imagepng($targetImage, null, 9);
            $resizedData = ob_get_clean();

            imagedestroy($sourceImage);
            imagedestroy($targetImage);

            return $resizedData;

        } catch (\Exception $e) {
            Log::error('[CommonAvatarService] Exception during image resize', [
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Get avatar and return as HTTP response
     */
    public static function getAvatarResponse(string $seed, ?int $size = null, string|int|null $providerIdentifier = null)
    {
        $size = $size ?? self::DEFAULT_SIZE;
        $requestedSize = $size;

        // Clamp size to valid range
        if ($size < 1) {
            $size = 1;
        } elseif ($size > self::MAX_CACHE_SIZE) {
            $size = self::MAX_CACHE_SIZE;
        }

        // Get avatar from cache or provider
        $result = self::getAvatar($seed, $providerIdentifier);

        if (!$result['success']) {
            return Response::json([
                'error' => $result['error'] ?? 'Unknown error',
            ], $result['status_code'] ?? 500);
        }

        $imageData = $result['data'];
        $fromCache = $result['from_cache'];
        $providerCode = $result['provider'];
        $requestedProviderCode = $result['requested_provider'] ?? null;
        $fallbackUsed = $result['fallback_used'] ?? false;

        // Resize if needed
        if ($size !== self::MAX_CACHE_SIZE) {
            $resizedData = self::resizeImage($imageData, $size);

            if ($resizedData === false) {
                Log::warning('[CommonAvatarService] Resize failed, returning original', [
                    'seed' => $seed,
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
            'X-Provider' => $providerCode,
            'X-Cached-Resolution' => self::MAX_CACHE_SIZE . 'x' . self::MAX_CACHE_SIZE,
            'X-Returned-Size' => $size . 'x' . $size,
        ];

        // Add requested provider info if different from actual provider
        if ($requestedProviderCode) {
            $headers['X-Requested-Provider'] = $requestedProviderCode;
        }

        // Add fallback indicator
        if ($fallbackUsed) {
            $headers['X-Fallback-Used'] = 'true';
        }

        if ($requestedSize !== $size) {
            $headers['X-Size-Clamped'] = 'true';
            $headers['X-Requested-Size'] = $requestedSize . 'x' . $requestedSize;
        }

        return Response::make($imageData, 200, $headers);
    }

    /**
     * Get all available providers info
     */
    public static function getProvidersInfo(): array
    {
        return AvatarProviderRegistry::getAllProviders();
    }

    /**
     * Clear cache for specific seed and provider
     */
    public static function clearCache(string $seed, string|int|null $providerIdentifier = null): bool
    {
        $provider = AvatarProviderRegistry::getProvider($providerIdentifier);

        if (!$provider) {
            return false;
        }

        $cacheDir = self::getCacheDir();
        $filename = self::getCacheFilename($seed, $provider->getShortCode());
        $cachePath = $cacheDir . '/' . $filename;

        if (file_exists($cachePath)) {
            $deleted = unlink($cachePath);
            Log::info('[CommonAvatarService] Cache cleared', [
                'seed' => $seed,
                'provider' => $provider->getShortCode(),
                'success' => $deleted,
            ]);
            return $deleted;
        }

        return false;
    }

    /**
     * Get cache statistics
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

        Log::info('[CommonAvatarService] All cache cleared', ['deleted' => $deleted]);

        return [
            'success' => true,
            'deleted_count' => $deleted,
        ];
    }
}
