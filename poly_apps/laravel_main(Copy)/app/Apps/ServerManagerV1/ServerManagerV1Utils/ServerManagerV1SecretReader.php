<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use App\Helpers\GlobalSecretReader;

/**
 * ServerManagerV1 Secret Reader
 * @deprecated Use App\Helpers\GlobalSecretReader instead
 */
class ServerManagerV1SecretReader
{
    /**
     * Get secret content by key name
     * @deprecated Use GlobalSecretReader::getSecretContent() instead
     */
    public static function getSecretContent(string $keyName): ?string
    {
        $content = GlobalSecretReader::getSecretContent($keyName);
        return $content !== '' ? $content : null;
    }
}
