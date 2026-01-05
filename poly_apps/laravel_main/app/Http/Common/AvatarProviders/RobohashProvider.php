<?php

namespace App\Http\Common\AvatarProviders;

/**
 * RoboHash Provider
 *
 * Generate robot/monster/kitten avatars from text
 * URL: https://robohash.org/
 */
class RobohashProvider extends AbstractAvatarProvider
{
    protected string $name = 'RoboHash';
    protected string $shortCode = 'robohash';
    protected int $maxSize = 512;
    protected bool $supportsSize = true;
    protected bool $isDeterministic = true;

    public function getAvatarUrl(string $seed, int $size = 512): string
    {
        $size = min($size, $this->maxSize);
        return "https://robohash.org/" . urlencode($seed) . "?size={$size}x{$size}";
    }
}
