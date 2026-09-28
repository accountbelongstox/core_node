<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use App\Utils\SecretStore;

/**
 * ServerManagerV1 Secret Reader
 * @deprecated Use App\Utils\SecretStore instead
 */
class ServerManagerV1SecretReader
{
    /**
     * Get secret content by key name
     * @deprecated Use SecretStore::get() instead
     */
    public static function getSecretContent(string $keyName): ?string
    {
        $content = SecretStore::get($keyName);
        return $content !== '' ? $content : null;
    }
}
