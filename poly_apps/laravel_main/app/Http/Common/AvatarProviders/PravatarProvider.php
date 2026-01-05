<?php

namespace App\Http\Common\AvatarProviders;

/**
 * Pravatar Provider
 *
 * Free CC0 avatar placeholder service with real person photos
 * URL: https://pravatar.cc/
 */
class PravatarProvider extends AbstractAvatarProvider
{
    protected string $name = 'Pravatar';
    protected string $shortCode = 'pravatar';
    protected int $maxSize = 512;
    protected bool $supportsSize = true;
    protected bool $isDeterministic = false; // Random based on seed

    public function getAvatarUrl(string $seed, int $size = 512): string
    {
        $size = min($size, $this->maxSize);
        return "https://i.pravatar.cc/{$size}?u=" . urlencode($seed);
    }
}
