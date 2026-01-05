<?php

namespace App\Http\Common\AvatarProviders;

/**
 * DiceBear Provider (Pixel Art Style)
 *
 * Open source avatar library - pixel art style
 * URL: https://www.dicebear.com/
 * Style: pixel-art (retro 8-bit avatars)
 */
class DicebearpixelProvider extends AbstractAvatarProvider
{
    protected string $name = 'DiceBear (Pixel Art)';
    protected string $shortCode = 'dicebear-pixel';
    protected int $maxSize = 512;
    protected bool $supportsSize = true;
    protected bool $isDeterministic = true;

    public function getAvatarUrl(string $seed, int $size = 512): string
    {
        $size = min($size, $this->maxSize);
        return "https://api.dicebear.com/7.x/pixel-art/png?seed=" . urlencode($seed) . "&size={$size}";
    }
}
