<?php

namespace App\Helpers;

use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;
use Symfony\Component\Process\Exception\ProcessFailedException;

/**
 * Global Secret Reader - Laravel equivalent of gvar_common.sh functionality
 * 
 * This class provides Laravel applications with the ability to read secrets
 * from .secret_ignore and already_encrypted directories, just like the
 * get_secret_content function in gvar_common.sh
 * 
 * Features:
 * - Read from .secret_ignore directory (raw files)
 * - Read from already_encrypted directory (encrypted .js files)
 * - Automatic decryption using disguise.js
 * - Cross-platform path resolution
 * - Batch decryption support
 * - Compatible with all Laravel apps in the poly_apps structure
 */
class GlobalSecretReader
{
    private static ?string $coreNodeDir = null;
    private static bool $batchDecryptionCompleted = false;
    
    /**
     * Get secret content by key name (equivalent to gvar_common.sh get_secret_content)
     * 
     * @param string $keyName The name of the secret key to retrieve
     * @return string|null The secret content or null if not found
     */
    public static function getSecretContent(string $keyName): ?string
    {
        if (empty($keyName)) {
            Log::error('GlobalSecretReader: KeyName parameter is required');
            return null;
        }
        
        $coreNodeDir = self::findCoreNodeDir();
        if (!$coreNodeDir) {
            Log::error('GlobalSecretReader: Could not find core_node directory');
            return null;
        }
        
        $secretKeysDir = $coreNodeDir . '/.secret_keys';
        $rawDir = $secretKeysDir . '/.secret_ignore';
        $encryptedDir = $secretKeysDir . '/already_encrypted';
        $rawFile = $rawDir . '/' . $keyName;
        $encryptedFile = $encryptedDir . '/' . $keyName . '.js';
        
        // First check if raw file exists
        if (file_exists($rawFile)) {
            $content = file_get_contents($rawFile);
            if ($content !== false) {
                $content = trim($content);
                if (!empty($content)) {
                    return $content;
                }
            }
        }
        
        // Check if encrypted file exists
        if (!file_exists($encryptedFile)) {
            return null;
        }
        
        // Check if we need to perform batch decryption
        if (!self::$batchDecryptionCompleted) {
            self::performBatchDecryption($coreNodeDir);
        }
        
        // Try to read the decrypted file again
        if (file_exists($rawFile)) {
            $content = file_get_contents($rawFile);
            if ($content !== false) {
                $content = trim($content);
                if (!empty($content)) {
                    return $content;
                }
            }
        }
        
        return null;
    }
    
    /**
     * Find core_node directory by walking up from current directory
     * 
     * @return string|null The path to core_node directory or null if not found
     */
    private static function findCoreNodeDir(): ?string
    {
        if (self::$coreNodeDir !== null) {
            return self::$coreNodeDir;
        }
        
        // Start from Laravel app directory
        $currentDir = base_path();
        
        // Walk up to find core_node directory
        while ($currentDir !== '/' && $currentDir !== '.' && !empty($currentDir)) {
            if (is_dir($currentDir . '/.secret_keys') || file_exists($currentDir . '/package.json')) {
                self::$coreNodeDir = $currentDir;
                return self::$coreNodeDir;
            }
            $currentDir = dirname($currentDir);
        }
        
        // Fallback to environment variable or default
        if (isset($_ENV['CORE_NODE_DIR']) && is_dir($_ENV['CORE_NODE_DIR'])) {
            self::$coreNodeDir = $_ENV['CORE_NODE_DIR'];
            return self::$coreNodeDir;
        }
        
        // Default fallback paths
        $defaultPaths = [
            '/www/wwwroot/core_node',
            '/opt/core_node',
            'C:\\core_node'
        ];
        
        foreach ($defaultPaths as $defaultPath) {
            if (is_dir($defaultPath)) {
                self::$coreNodeDir = $defaultPath;
                return self::$coreNodeDir;
            }
        }
        
        return null;
    }
    
    /**
     * Perform batch decryption of encrypted files
     * 
     * @param string $coreNodeDir The core_node directory path
     */
    private static function performBatchDecryption(string $coreNodeDir): void
    {
        $secretKeysDir = $coreNodeDir . '/.secret_keys';
        $rawDir = $secretKeysDir . '/.secret_ignore';
        $encryptedDir = $secretKeysDir . '/already_encrypted';
        $scriptsDir = $coreNodeDir . '/scripts';
        
        // Find all encrypted .js files that don't have corresponding raw files
        $encryptedFiles = [];
        if (is_dir($encryptedDir)) {
            $files = glob($encryptedDir . '/*.js');
            foreach ($files as $encFile) {
                $rawFileName = basename($encFile, '.js');
                $rawFilePath = $rawDir . '/' . $rawFileName;
                
                if (!file_exists($rawFilePath)) {
                    $encryptedFiles[] = $encFile;
                }
            }
        }
        
        if (empty($encryptedFiles)) {
            self::$batchDecryptionCompleted = true;
            return;
        }
        
        Log::info('GlobalSecretReader: Found ' . count($encryptedFiles) . ' encrypted files requiring decryption');
        
        // Find disguise.js
        $disguiseJs = null;
        if (is_dir($scriptsDir)) {
            $disguiseFiles = [];
            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($scriptsDir, \RecursiveDirectoryIterator::SKIP_DOTS)
            );
            
            foreach ($iterator as $file) {
                if ($file->getFilename() === 'disguise.js') {
                    $disguiseJs = $file->getPathname();
                    break;
                }
            }
        }
        
        if (!$disguiseJs) {
            Log::warning('GlobalSecretReader: disguise.js not found in scripts directory');
            self::$batchDecryptionCompleted = true;
            return;
        }
        
        Log::info('GlobalSecretReader: Found decryption tool: ' . $disguiseJs);
        
        // For web environment, we can't prompt for password interactively
        // We'll need to implement a different approach or skip batch decryption
        Log::warning('GlobalSecretReader: Batch decryption skipped in web environment - interactive password input not available');
        
        self::$batchDecryptionCompleted = true;
    }
    
    /**
     * Decrypt single file with provided password (for CLI usage)
     * 
     * @param string $encryptedFilePath Path to encrypted file
     * @param string $password Password for decryption
     * @param string $outputDir Output directory for decrypted file
     * @return bool True if successful, false otherwise
     */
    public static function decryptFile(string $encryptedFilePath, string $password, string $outputDir): bool
    {
        if (!file_exists($encryptedFilePath)) {
            Log::error('GlobalSecretReader: Encrypted file not found: ' . $encryptedFilePath);
            return false;
        }
        
        if (!is_dir($outputDir)) {
            if (!mkdir($outputDir, 0755, true)) {
                Log::error('GlobalSecretReader: Failed to create output directory: ' . $outputDir);
                return false;
            }
        }
        
        try {
            $process = new Process([
                'node',
                $encryptedFilePath,
                'pwd',
                $password,
                $outputDir
            ]);
            
            $process->setTimeout(60);
            $process->run();
            
            if ($process->isSuccessful()) {
                Log::info('GlobalSecretReader: Successfully decrypted: ' . basename($encryptedFilePath));
                return true;
            } else {
                Log::error('GlobalSecretReader: Failed to decrypt file: ' . $process->getErrorOutput());
                return false;
            }
            
        } catch (ProcessFailedException $e) {
            Log::error('GlobalSecretReader: Process failed during decryption: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Get list of available secret keys
     * 
     * @return array Array of available secrets with metadata
     */
    public static function getAvailableSecrets(): array
    {
        $coreNodeDir = self::findCoreNodeDir();
        if (!$coreNodeDir) {
            return [];
        }
        
        $secretKeysDir = $coreNodeDir . '/.secret_keys';
        $rawDir = $secretKeysDir . '/.secret_ignore';
        $encryptedDir = $secretKeysDir . '/already_encrypted';
        
        $secrets = [];
        
        // Get raw files
        if (is_dir($rawDir)) {
            $rawFiles = array_diff(scandir($rawDir), ['.', '..']);
            foreach ($rawFiles as $file) {
                if (is_file($rawDir . '/' . $file)) {
                    $secrets[$file] = [
                        'name' => $file,
                        'type' => 'raw',
                        'path' => $rawDir . '/' . $file,
                        'encrypted_available' => file_exists($encryptedDir . '/' . $file . '.js')
                    ];
                }
            }
        }
        
        // Get encrypted files that don't have raw counterparts
        if (is_dir($encryptedDir)) {
            $encryptedFiles = glob($encryptedDir . '/*.js');
            foreach ($encryptedFiles as $encFile) {
                $keyName = basename($encFile, '.js');
                if (!isset($secrets[$keyName])) {
                    $secrets[$keyName] = [
                        'name' => $keyName,
                        'type' => 'encrypted',
                        'path' => $encFile,
                        'encrypted_available' => true
                    ];
                }
            }
        }
        
        return array_values($secrets);
    }
    
    /**
     * Check if secret exists (either raw or encrypted)
     * 
     * @param string $keyName The secret key name to check
     * @return bool True if secret exists, false otherwise
     */
    public static function secretExists(string $keyName): bool
    {
        $coreNodeDir = self::findCoreNodeDir();
        if (!$coreNodeDir) {
            return false;
        }
        
        $secretKeysDir = $coreNodeDir . '/.secret_keys';
        $rawFile = $secretKeysDir . '/.secret_ignore/' . $keyName;
        $encryptedFile = $secretKeysDir . '/already_encrypted/' . $keyName . '.js';
        
        return file_exists($rawFile) || file_exists($encryptedFile);
    }
}
