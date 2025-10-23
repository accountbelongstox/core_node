<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use Illuminate\Support\Facades\Log;

class ServerManagerV1SSLConfigReader
{
    private const CONFIG_DIR_PATH = '/www/wwwroot/core_node/.secret_keys/.secret_ignore';
    private const DD_SCRIPT_PATH = '/www/wwwroot/core_node/scripts/dd.sh';

    private static ?array $cachedConfig = null;
    
    /**
     * Get SSL configuration from directory with uppercase files
     */
    public static function getSSLConfig(): array
    {
        if (self::$cachedConfig !== null) {
            return self::$cachedConfig;
        }

        if (!is_dir(self::CONFIG_DIR_PATH)) {
            throw new \Exception("SSL configuration directory not found. Please run dd.sh to decrypt SSL configuration.");
        }

        // Look for uppercase files without extension in the directory
        $configFiles = glob(self::CONFIG_DIR_PATH . '/*');
        $jsonFile = null;

        foreach ($configFiles as $file) {
            if (is_file($file)) {
                $filename = basename($file);
                // Check if filename is uppercase (allowing underscores) and has no extension
                if (preg_match('/^[A-Z_]+$/', $filename) && strpos($filename, '.') === false) {
                    // Prefer files ending with _JSON, but accept any uppercase file
                    if (strpos($filename, '_JSON') !== false) {
                        $jsonFile = $file;
                        break;
                    } elseif (!$jsonFile) {
                        // Use as fallback if no _JSON file found
                        $jsonFile = $file;
                    }
                }
            }
        }

        if (!$jsonFile) {
            throw new \Exception("SSL configuration JSON file not found in directory. Please run dd.sh to decrypt SSL configuration.");
        }

        $content = file_get_contents($jsonFile);
        if ($content === false) {
            throw new \Exception("Failed to read SSL configuration file: " . basename($jsonFile) . ". Please run dd.sh to decrypt SSL configuration.");
        }

        $config = json_decode($content, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \Exception("Invalid SSL configuration JSON format in file: " . basename($jsonFile) . ". Please run dd.sh to decrypt SSL configuration.");
        }

        if (!isset($config['ssl_config'])) {
            throw new \Exception("SSL configuration section not found in file: " . basename($jsonFile) . ". Please run dd.sh to decrypt SSL configuration.");
        }

        self::$cachedConfig = $config;

        Log::info('ServerManagerV1: SSL configuration loaded successfully from file: ' . basename($jsonFile));

        return self::$cachedConfig;
    }
    
    /**
     * Get default SSL provider
     */
    public static function getDefaultProvider(): string
    {
        $config = self::getSSLConfig();
        return $config['ssl_config']['default_provider'] ?? 'letsencrypt';
    }
    
    /**
     * Get default email for SSL certificates
     */
    public static function getDefaultEmail(): string
    {
        $config = self::getSSLConfig();
        return $config['ssl_config']['default_email'] ?? '';
    }
    
    /**
     * Get provider configuration
     */
    public static function getProviderConfig(string $provider): array
    {
        $config = self::getSSLConfig();
        
        if (!isset($config['ssl_config']['providers'][$provider])) {
            throw new \Exception("SSL provider '$provider' not found in configuration.");
        }
        
        $providerConfig = $config['ssl_config']['providers'][$provider];
        
        if (!($providerConfig['enabled'] ?? true)) {
            throw new \Exception("SSL provider '$provider' is disabled in configuration.");
        }
        
        return $providerConfig;
    }
    
    /**
     * Get all available providers
     */
    public static function getAvailableProviders(): array
    {
        $config = self::getSSLConfig();
        $providers = [];
        
        foreach ($config['ssl_config']['providers'] ?? [] as $name => $providerConfig) {
            if ($providerConfig['enabled'] ?? true) {
                $providers[$name] = [
                    'name' => $name,
                    'challenge_type' => $providerConfig['challenge_type'] ?? 'http-01',
                    'description' => $providerConfig['description'] ?? $name
                ];
            }
        }
        
        return $providers;
    }
    
    /**
     * Check if staging mode is enabled
     */
    public static function isStagingMode(): bool
    {
        $config = self::getSSLConfig();
        return $config['ssl_config']['staging'] ?? false;
    }
    
    /**
     * Get deployment configuration
     */
    public static function getDeploymentConfig(): array
    {
        $config = self::getSSLConfig();
        return $config['deployment_config'] ?? [];
    }
    
    /**
     * Get default PHP version
     */
    public static function getDefaultPhpVersion(): string
    {
        $deploymentConfig = self::getDeploymentConfig();
        return $deploymentConfig['default_php_version'] ?? '8.2';
    }
    
    /**
     * Get default web root
     */
    public static function getDefaultWebRoot(): string
    {
        $deploymentConfig = self::getDeploymentConfig();
        return $deploymentConfig['default_web_root'] ?? '/www/wwwroot';
    }

    /**
     * Resolve web directory path
     * If path is absolute, use as-is. Otherwise, treat as subdirectory under /www/wwwroot
     */
    public static function resolveWebDirectory(string $path): string
    {
        // If path starts with /, it's absolute
        if (strpos($path, '/') === 0) {
            return $path;
        }

        // Otherwise, treat as subdirectory under default web root
        $webRoot = self::getDefaultWebRoot();
        return rtrim($webRoot, '/') . '/' . ltrim($path, '/');
    }
    
    /**
     * Check if auto SSL is enabled
     */
    public static function isAutoSSLEnabled(): bool
    {
        $deploymentConfig = self::getDeploymentConfig();
        return $deploymentConfig['auto_ssl'] ?? true;
    }
    
    /**
     * Check if auto backup is enabled
     */
    public static function isAutoBackupEnabled(): bool
    {
        $deploymentConfig = self::getDeploymentConfig();
        return $deploymentConfig['auto_backup'] ?? true;
    }
    
    /**
     * Get nginx configuration paths
     */
    public static function getNginxPaths(): array
    {
        $deploymentConfig = self::getDeploymentConfig();
        return [
            'config_path' => $deploymentConfig['nginx_config_path'] ?? '/etc/nginx/sites-available',
            'enabled_path' => $deploymentConfig['nginx_enabled_path'] ?? '/etc/nginx/sites-enabled',
            'backup_path' => $deploymentConfig['backup_path'] ?? '/www/backup/nginx-configs'
        ];
    }
    
    /**
     * Get security configuration
     */
    public static function getSecurityConfig(): array
    {
        $config = self::getSSLConfig();
        return $config['security_config'] ?? [];
    }
    
    /**
     * Check if domain is allowed
     */
    public static function isDomainAllowed(string $domain): bool
    {
        $securityConfig = self::getSecurityConfig();
        
        // Check blocked domains
        $blockedDomains = $securityConfig['blocked_domains'] ?? [];
        foreach ($blockedDomains as $blocked) {
            if (fnmatch($blocked, $domain)) {
                return false;
            }
        }
        
        // Check allowed domains (if specified)
        $allowedDomains = $securityConfig['allowed_domains'] ?? [];
        if (!empty($allowedDomains)) {
            foreach ($allowedDomains as $allowed) {
                if (fnmatch($allowed, $domain)) {
                    return true;
                }
            }
            return false; // Domain not in allowed list
        }
        
        return true; // No restrictions or domain is allowed
    }
    
    /**
     * Get rate limit for deployments
     */
    public static function getDeploymentRateLimit(): int
    {
        $securityConfig = self::getSecurityConfig();
        return $securityConfig['max_deployments_per_hour'] ?? 10;
    }
    
    /**
     * Check if confirmation is required
     */
    public static function requiresConfirmation(): bool
    {
        $securityConfig = self::getSecurityConfig();
        return $securityConfig['require_confirmation'] ?? false;
    }
    
    /**
     * Validate configuration file
     */
    public static function validateConfig(): array
    {
        $errors = [];
        
        try {
            $config = self::getSSLConfig();
            
            // Check required sections
            if (!isset($config['ssl_config'])) {
                $errors[] = "Missing ssl_config section";
            }
            
            // Check default provider
            $defaultProvider = $config['ssl_config']['default_provider'] ?? '';
            if (empty($defaultProvider)) {
                $errors[] = "Missing default_provider in ssl_config";
            }
            
            // Check default email
            $defaultEmail = $config['ssl_config']['default_email'] ?? '';
            if (empty($defaultEmail) || !filter_var($defaultEmail, FILTER_VALIDATE_EMAIL)) {
                $errors[] = "Invalid or missing default_email in ssl_config";
            }
            
            // Check providers
            $providers = $config['ssl_config']['providers'] ?? [];
            if (empty($providers)) {
                $errors[] = "No SSL providers configured";
            }
            
            // Validate each provider
            foreach ($providers as $name => $providerConfig) {
                if (!isset($providerConfig['challenge_type'])) {
                    $errors[] = "Missing challenge_type for provider: $name";
                }
                
                if ($providerConfig['challenge_type'] === 'dns-01') {
                    // Check DNS provider specific requirements
                    if ($name === 'dnspod') {
                        // Check if DNSPod credentials are available from secret storage
                        try {
                            $email = \App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1SecretReader::getSecretContent('dns_dnspod_email');
                            $apiToken = \App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1SecretReader::getSecretContent('dns_dnspod_api_token');

                            if (empty($email)) {
                                $errors[] = "DNSPod provider missing email in secret storage";
                            }

                            if (empty($apiToken)) {
                                $errors[] = "DNSPod provider missing api_token in secret storage";
                            } else {
                                // Validate token format: "id,token"
                                $tokenParts = explode(',', $apiToken, 2);
                                if (count($tokenParts) !== 2) {
                                    $errors[] = "DNSPod api_token format invalid. Expected: 'id,token'";
                                }
                            }
                        } catch (\Exception $e) {
                            $errors[] = "Failed to read DNSPod credentials from secret storage: " . $e->getMessage();
                        }
                    }

                    if ($name === 'cloudflare' && empty($providerConfig['api_token'])) {
                        $errors[] = "Cloudflare provider missing api_token";
                    }
                }
            }
            
        } catch (\Exception $e) {
            $errors[] = $e->getMessage();
        }
        
        return $errors;
    }
    
    /**
     * Clear cached configuration
     */
    public static function clearCache(): void
    {
        self::$cachedConfig = null;
    }
    
    /**
     * Check if dd.sh script exists
     */
    public static function ddScriptExists(): bool
    {
        return file_exists(self::DD_SCRIPT_PATH);
    }
    
    /**
     * Get dd.sh script path
     */
    public static function getDdScriptPath(): string
    {
        return self::DD_SCRIPT_PATH;
    }
}
