<?php

namespace App\Http\Common\AvatarProviders;

/**
 * Avatar Provider Interface
 *
 * All avatar providers must implement this interface
 */
interface AvatarProviderInterface
{
    /**
     * Get provider name
     *
     * @return string
     */
    public function getName(): string;

    /**
     * Get provider short code
     *
     * @return string
     */
    public function getShortCode(): string;

    /**
     * Get maximum supported size
     *
     * @return int
     */
    public function getMaxSize(): int;

    /**
     * Check if provider supports size parameter
     *
     * @return bool
     */
    public function supportsSize(): bool;

    /**
     * Check if provider is deterministic (same seed = same avatar)
     *
     * @return bool
     */
    public function isDeterministic(): bool;

    /**
     * Get avatar image URL
     *
     * @param string $seed Username or any identifier
     * @param int $size Image size
     * @return string
     */
    public function getAvatarUrl(string $seed, int $size = 512): string;

    /**
     * Fetch avatar from provider
     *
     * @param string $seed Username or any identifier
     * @param int $size Image size
     * @return array ['success' => bool, 'data' => string, 'content_type' => string, 'error' => string]
     */
    public function fetchAvatar(string $seed, int $size = 512): array;
}
