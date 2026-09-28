<?php

namespace App\Helpers;

use App\Utils\SecretStore;

/**
 * Backward-compatible facade for the shared secret store.
 */
class GlobalSecretReader
{
    /**
     * Get secret content by key name
     * 
     * @param string $keyName The name of the secret key to retrieve
     * @return string The secret content, encrypted file content, or empty string if not found
     */
    public static function getSecretContent(string $keyName): string
    {
        return SecretStore::get($keyName);
    }
}
