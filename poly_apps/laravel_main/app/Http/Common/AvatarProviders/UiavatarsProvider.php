<?php

namespace App\Http\Common\AvatarProviders;

/**
 * UI Avatars Provider
 *
 * Generate avatars with initials from names
 * URL: https://ui-avatars.com/
 */
class UiavatarsProvider extends AbstractAvatarProvider
{
    protected string $name = 'UI Avatars';
    protected string $shortCode = 'uiavatars';
    protected int $maxSize = 512;
    protected bool $supportsSize = true;
    protected bool $isDeterministic = true;

    public function getAvatarUrl(string $seed, int $size = 512): string
    {
        $size = min($size, $this->maxSize);
        return "https://ui-avatars.com/api/?name=" . urlencode($seed) . "&size={$size}";
    }
}
