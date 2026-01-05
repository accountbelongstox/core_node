<?php

namespace App\Http\Common\AvatarProviders;

/**
 * DiceBear Provider (Avataaars Style)
 *
 * Open source avatar library with multiple styles
 * URL: https://www.dicebear.com/
 * Style: avataaars (cartoon avatars)
 */
class DicebearProvider extends AbstractAvatarProvider
{
    protected string $name = 'DiceBear (Avataaars)';
    protected string $shortCode = 'dicebear';
    protected int $maxSize = 512;
    protected bool $supportsSize = true;
    protected bool $isDeterministic = true;

    public function getAvatarUrl(string $seed, int $size = 512): string
    {
        $size = min($size, $this->maxSize);
        return "https://api.dicebear.com/7.x/avataaars/png?seed=" . urlencode($seed) . "&size={$size}";
    }
}
