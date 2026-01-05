<?php

namespace App\Http\Common\AvatarProviders;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Abstract Avatar Provider Base Class
 *
 * Provides common functionality for all avatar providers
 */
abstract class AbstractAvatarProvider implements AvatarProviderInterface
{
    protected string $name;
    protected string $shortCode;
    protected int $maxSize = 512;
    protected bool $supportsSize = true;
    protected bool $isDeterministic = true;
    protected int $timeout = 10;

    /**
     * Get provider name
     */
    public function getName(): string
    {
        return $this->name;
    }

    /**
     * Get provider short code
     */
    public function getShortCode(): string
    {
        return $this->shortCode;
    }

    /**
     * Get maximum supported size
     */
    public function getMaxSize(): int
    {
        return $this->maxSize;
    }

    /**
     * Check if provider supports size parameter
     */
    public function supportsSize(): bool
    {
        return $this->supportsSize;
    }

    /**
     * Check if provider is deterministic
     */
    public function isDeterministic(): bool
    {
        return $this->isDeterministic;
    }

    /**
     * Fetch avatar from provider
     */
    public function fetchAvatar(string $seed, int $size = 512): array
    {
        try {
            $url = $this->getAvatarUrl($seed, $size);

            Log::info('[AvatarProvider] Fetching avatar', [
                'provider' => $this->getShortCode(),
                'seed' => $seed,
                'size' => $size,
                'url' => $url,
            ]);

            $response = Http::timeout($this->timeout)
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
                ])
                ->get($url);

            if (!$response->successful()) {
                Log::error('[AvatarProvider] Failed to fetch avatar', [
                    'provider' => $this->getShortCode(),
                    'status' => $response->status(),
                    'seed' => $seed,
                ]);

                return [
                    'success' => false,
                    'error' => 'HTTP ' . $response->status(),
                    'status_code' => $response->status(),
                ];
            }

            $imageData = $response->body();
            $contentType = $response->header('Content-Type') ?? 'image/png';

            Log::info('[AvatarProvider] Avatar fetched successfully', [
                'provider' => $this->getShortCode(),
                'seed' => $seed,
                'size' => strlen($imageData),
                'content_type' => $contentType,
            ]);

            return [
                'success' => true,
                'data' => $imageData,
                'content_type' => $contentType,
            ];

        } catch (\Exception $e) {
            Log::error('[AvatarProvider] Exception during avatar fetch', [
                'provider' => $this->getShortCode(),
                'error' => $e->getMessage(),
                'seed' => $seed,
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get avatar image URL (must be implemented by subclass)
     */
    abstract public function getAvatarUrl(string $seed, int $size = 512): string;
}
