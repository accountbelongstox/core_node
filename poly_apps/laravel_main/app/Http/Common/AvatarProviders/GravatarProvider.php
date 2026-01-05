<?php

namespace App\Http\Common\AvatarProviders;

/**
 * Gravatar Provider
 *
 * WordPress official avatar service
 * URL: https://gravatar.com/
 */
class GravatarProvider extends AbstractAvatarProvider
{
    protected string $name = 'Gravatar';
    protected string $shortCode = 'gravatar';
    protected int $maxSize = 2048;
    protected bool $supportsSize = true;
    protected bool $isDeterministic = true;

    public function getAvatarUrl(string $seed, int $size = 512): string
    {
        $size = min($size, $this->maxSize);
        $hash = md5(strtolower(trim($seed)));
        return "https://www.gravatar.com/avatar/{$hash}?s={$size}&d=identicon";
    }
}
