<?php

namespace App\Http\Common\AvatarProviders;

/**
 * DiceBear Provider (Bottts Style)
 *
 * Open source avatar library - robot style
 * URL: https://www.dicebear.com/
 * Style: bottts (robot avatars)
 */
class DicebearbotttsProvider extends AbstractAvatarProvider
{
    protected string $name = 'DiceBear (Bottts/Robots)';
    protected string $shortCode = 'dicebear-bottts';
    protected int $maxSize = 512;
    protected bool $supportsSize = true;
    protected bool $isDeterministic = true;

    public function getAvatarUrl(string $seed, int $size = 512): string
    {
        $size = min($size, $this->maxSize);
        return "https://api.dicebear.com/7.x/bottts/png?seed=" . urlencode($seed) . "&size={$size}";
    }
}
