<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;
use Symfony\Component\Process\Exception\ProcessFailedException;

class ServerManagerV1SecretReader
{
    private static ?string $coreNodeDir = null;
    private static bool $batchDecryptionCompleted = false;
    
    /**
     * Get secret content by key name (equivalent to gvar_common.sh get_secret_content)
     */
    public static function getSecretContent(string $keyName): ?string
    {
        if (empty($keyName)) {
            Log::error('KeyName parameter is required');
            return null;
        }
        
        $coreNodeDir = self::findCoreNodeDir();
        if (!$coreNodeDir) {
            Log::error('Could not find core_node directory');
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
     */
    private static function findCoreNodeDir(): ?string
    {
        if (self::$coreNodeDir !== null) {
            return self::$coreNodeDir;
        }

        // Try multiple possible paths
        $possiblePaths = [
            // From Laravel base path, walk up to find core_node
            dirname(dirname(dirname(base_path()))), // Assuming Laravel is in core_node/poly_apps/laravel_main
            dirname(dirname(base_path())), // Assuming Laravel is in core_node/poly_apps
            dirname(base_path()), // Assuming Laravel is in core_node
            base_path(), // Laravel itself is core_node
            // Environment variable
            $_ENV['CORE_NODE_DIR'] ?? null,
            // Common paths
            '/mnt/d/programing/core_node',
            '/opt/core_node',
            '/var/www/core_node'
        ];

        foreach ($possiblePaths as $path) {
            if (empty($path)) continue;

            if (is_dir($path . '/.secret_keys')) {
                self::$coreNodeDir = $path;
                Log::info('Found core_node directory', ['path' => $path]);
                return self::$coreNodeDir;
            }
        }

        // Walk up from Laravel app directory as fallback
        $currentDir = base_path();
        while ($currentDir !== '/' && $currentDir !== '.' && !empty($currentDir)) {
            if (is_dir($currentDir . '/.secret_keys')) {
                self::$coreNodeDir = $currentDir;
                Log::info('Found core_node directory by walking up', ['path' => $currentDir]);
                return self::$coreNodeDir;
            }
            $currentDir = dirname($currentDir);
        }

        Log::error('Could not find core_node directory with .secret_keys', [
            'base_path' => base_path(),
            'checked_paths' => array_filter($possiblePaths)
        ]);

        return null;
    }
    
    /**
     * Perform batch decryption of encrypted files
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
        
        Log::info('Found ' . count($encryptedFiles) . ' encrypted files requiring decryption');
        
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
            Log::warning('disguise.js not found in scripts directory');
            self::$batchDecryptionCompleted = true;
            return;
        }
        
        Log::info('Found decryption tool: ' . $disguiseJs);
        
        // For web environment, we can't prompt for password interactively
        // We'll need to implement a different approach or skip batch decryption
        Log::warning('Batch decryption skipped in web environment - interactive password input not available');
        
        self::$batchDecryptionCompleted = true;
    }
    
    /**
     * Decrypt single file with provided password (for CLI usage)
     */
    public static function decryptFile(string $encryptedFilePath, string $password, string $outputDir): bool
    {
        if (!file_exists($encryptedFilePath)) {
            Log::error('Encrypted file not found: ' . $encryptedFilePath);
            return false;
        }
        
        if (!is_dir($outputDir)) {
            if (!mkdir($outputDir, 0755, true)) {
                Log::error('Failed to create output directory: ' . $outputDir);
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
                Log::info('Successfully decrypted: ' . basename($encryptedFilePath));
                return true;
            } else {
                Log::error('Failed to decrypt file: ' . $process->getErrorOutput());
                return false;
            }
            
        } catch (ProcessFailedException $e) {
            Log::error('Process failed during decryption: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Encrypt file using disguise.js (for CLI usage)
     */
    public static function encryptFile(string $inputFilePath, string $password, string $outputDir = null): bool
    {
        if (!file_exists($inputFilePath)) {
            Log::error('Input file not found: ' . $inputFilePath);
            return false;
        }
        
        $coreNodeDir = self::findCoreNodeDir();
        if (!$coreNodeDir) {
            Log::error('Could not find core_node directory');
            return false;
        }
        
        $disguiseJs = $coreNodeDir . '/scripts/disguise.js';
        if (!file_exists($disguiseJs)) {
            Log::error('disguise.js not found: ' . $disguiseJs);
            return false;
        }
        
        try {
            $command = ['node', $disguiseJs, $inputFilePath, $password];
            if ($outputDir) {
                $command[] = $outputDir;
            }
            
            $process = new Process($command);
            $process->setTimeout(60);
            $process->run();
            
            if ($process->isSuccessful()) {
                Log::info('Successfully encrypted: ' . basename($inputFilePath));
                return true;
            } else {
                Log::error('Failed to encrypt file: ' . $process->getErrorOutput());
                return false;
            }
            
        } catch (ProcessFailedException $e) {
            Log::error('Process failed during encryption: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Get list of available secret keys
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
