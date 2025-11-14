<?php

namespace App\Helpers;

use App\Providers\PathMapper;

/**
 * Global Secret Reader - Read secrets from .secret_ignore or already_encrypted directories
 * 
 * This class provides simple secret reading functionality:
 * - Read from .secret_ignore directory (raw files)
 * - If not found, check if encrypted .js file exists in already_encrypted directory
 * - Return encrypted file content if found, empty string if not found
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
        if (empty($keyName)) {
            return '';
        }
        
        $coreNodeDir = PathMapper::getCoreNodeDir();
        if (!$coreNodeDir) {
            return '';
        }
        
        $rawFile = $coreNodeDir . '/.secret_keys/.secret_ignore/' . $keyName;
        $encryptedFile = $coreNodeDir . '/.secret_keys/already_encrypted/' . $keyName . '.js';
        
        // First check if raw file exists
        if (file_exists($rawFile)) {
            $content = file_get_contents($rawFile);
            if ($content !== false) {
                return trim($content);
            }
        }
        
        // Check if encrypted file exists
        if (file_exists($encryptedFile)) {
            $content = file_get_contents($encryptedFile);
            if ($content !== false) {
                return $content; // Return encrypted content that needs node.js decryption
            }
        }
        
        return '';
    }
}
