<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use Illuminate\Support\Facades\Log;
use App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig;
use App\Providers\PathMapper;

/**
 * Domain Management Utility for ServerManagerV1
 * 
 * Manages domain configurations in JSON files stored in laravel_data_dir (mapped via PathMapper)
 * instead of using database storage.
 */
class ServerManagerV1DomainManager
{
    // Use PathMapper for database directory
    private const DOMAINS_FILE = 'domains.json';
    private const DEPLOYMENTS_FILE = 'deployments.json';
    
    /**
     * Get domains database directory
     */
    private static function getDomainsDbDir(): string
    {
        return PathMapper::mapWebPath('laravel_data_dir') . '/servermanager/domains';
    }
    
    /**
     * Get domains database file path
     */
    private static function getDomainsFilePath(): string
    {
        return self::getDomainsDbDir() . '/' . self::DOMAINS_FILE;
    }
    
    /**
     * Get deployments database file path
     */
    private static function getDeploymentsFilePath(): string
    {
        return self::getDomainsDbDir() . '/' . self::DEPLOYMENTS_FILE;
    }
    
    /**
     * Ensure database directory exists
     */
    private static function ensureDbDirectory(): bool
    {
        $dbDir = self::getDomainsDbDir();
        if (!is_dir($dbDir)) {
            if (!mkdir($dbDir, 0755, true)) {
                Log::error('Failed to create domains database directory: ' . $dbDir);
                return false;
            }
        }
        return true;
    }
    
    /**
     * Load domains from JSON file
     */
    private static function loadDomains(): array
    {
        $filePath = self::getDomainsFilePath();
        
        if (!file_exists($filePath)) {
            return [];
        }
        
        $content = file_get_contents($filePath);
        if ($content === false) {
            Log::error('Failed to read domains file: ' . $filePath);
            return [];
        }
        
        $data = json_decode($content, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            Log::error('Invalid JSON in domains file: ' . json_last_error_msg());
            return [];
        }
        
        return $data['domains'] ?? [];
    }
    
    /**
     * Save domains to JSON file
     */
    private static function saveDomains(array $domains): bool
    {
        if (!self::ensureDbDirectory()) {
            return false;
        }
        
        $data = [
            'version' => '1.0',
            'updated_at' => date('Y-m-d H:i:s'),
            'domains' => $domains
        ];
        
        $filePath = self::getDomainsFilePath();
        $content = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        
        if (file_put_contents($filePath, $content) === false) {
            Log::error('Failed to save domains file: ' . $filePath);
            return false;
        }
        
        return true;
    }
    
    /**
     * Add or update domain configuration
     */
    /**
     * Refresh nginx configuration for existing domain
     * Re-generates nginx config files using current domain configuration
     *
     * @param string $domain Domain name
     * @return bool True if successful, false otherwise
     */
    public static function refreshDomainConfig(string $domain): bool
    {
        $config = self::getDomain($domain);

        if (!$config) {
            Log::error('Domain not found for refresh', ['domain' => $domain]);
            return false;
        }

        Log::info('Refreshing nginx configuration', ['domain' => $domain]);

        if (!self::generateNginxConfig($domain, $config)) {
            Log::error('Failed to regenerate nginx configuration', ['domain' => $domain]);
            return false;
        }

        Log::info('Nginx configuration refreshed successfully', ['domain' => $domain]);
        return true;
    }

    public static function addDomain(string $domain, array $config): bool
    {
        // Validate domain name format
        if (!self::validateDomainName($domain)) {
            Log::error('Invalid domain name format', ['domain' => $domain]);
            return false;
        }

        $domains = self::loadDomains();

        // Check for domain conflict (EXTENDED FEATURE)
        $existingConfig = self::getDomain($domain);
        $isUpdate = false;

        if ($existingConfig) {
            $isUpdate = true;
            Log::warning('Domain already exists, updating configuration', [
                'domain' => $domain,
                'old_type' => $existingConfig['type'],
                'new_type' => $config['type'] ?? 'unknown',
                'old_www_dir' => $existingConfig['www_dir'],
                'new_www_dir' => $config['www_dir'] ?? 'unknown'
            ]);

            // Record history for update
            self::recordHistory($domain, 'update', [
                'old_config' => $existingConfig,
                'new_config' => $config
            ]);
        } else {
            // Record history for new domain
            self::recordHistory($domain, 'create', [
                'config' => $config
            ]);
        }

        // Use PathMapper for environment-aware path (no hardcoded paths)
        $wwwroot = PathMapper::mapWebPath('wwwroot');
        $wwwDir = $config['www_dir'] ?? "$wwwroot/$domain";

        // Validate and ensure www directory exists
        if (!is_dir($wwwDir)) {
            if (!mkdir($wwwDir, 0755, true)) {
                Log::error('Failed to create www directory', [
                    'domain' => $domain,
                    'www_dir' => $wwwDir,
                    'error' => error_get_last()
                ]);
                return false;
            }
            Log::info('Created www directory', ['domain' => $domain, 'www_dir' => $wwwDir]);
        }

        // Verify www directory is writable
        if (!is_writable($wwwDir)) {
            Log::error('WWW directory is not writable', [
                'domain' => $domain,
                'www_dir' => $wwwDir,
                'permissions' => substr(sprintf('%o', fileperms($wwwDir)), -4)
            ]);
            return false;
        }

        // IMPORTANT: Check if another domain already uses this www_dir with Swoole
        // One directory = One Swoole service shared by multiple domains
        $sharedSwoolePort = null;
        $phpMode = ServerManagerV1PathConfig::normalizePhpMode($config['php_mode'] ?? 'fpm');

        if (ServerManagerV1PathConfig::isSwooleMode($phpMode)) {
            foreach ($domains as $existingDomain => $existingConfig) {
                if ($existingDomain === $domain) {
                    continue; // Skip self
                }

                if (($existingConfig['www_dir'] ?? '') === $wwwDir) {
                    // Found another domain using the same directory
                    $existingPhpMode = ServerManagerV1PathConfig::normalizePhpMode($existingConfig['php_mode'] ?? 'fpm');
                    if (ServerManagerV1PathConfig::isSwooleMode($existingPhpMode)) {
                        // It's using Swoole, share the same port
                        $sharedSwoolePort = $existingConfig['swoole_port'] ?? null;
                        if ($sharedSwoolePort) {
                            Log::info('Sharing Swoole port with existing domain', [
                                'domain' => $domain,
                                'existing_domain' => $existingDomain,
                                'shared_port' => $sharedSwoolePort,
                                'www_dir' => $wwwDir
                            ]);
                            break;
                        }
                    }
                }
            }
        }

        // Auto-assign Swoole port if needed
        $swoolePort = $config['swoole_port'] ?? $sharedSwoolePort;
        if (ServerManagerV1PathConfig::isSwooleMode($phpMode) && !$swoolePort) {
            $swoolePort = self::getNextAvailableSwoolePort();
            Log::info('Auto-assigned Swoole port', [
                'domain' => $domain,
                'port' => $swoolePort
            ]);
        }

        // Get Swoole service name (auto-computed from path and port)
        $swooleServiceName = null;
        if (ServerManagerV1PathConfig::isSwooleMode($phpMode) && $swoolePort) {
            $swooleServiceName = ServerManagerV1OctaneServiceManager::getOctaneServiceNameFromPath($wwwDir, $swoolePort);
            Log::info('Computed Swoole service name', [
                'domain' => $domain,
                'service_name' => $swooleServiceName,
                'www_dir' => $wwwDir,
                'port' => $swoolePort
            ]);
        }

        $domainConfig = [
            'domain' => $domain,
            'type' => $config['type'] ?? 'laravel',
            'www_dir' => $wwwDir,
            'php_version' => $config['php_version'] ?? '8.4',
            'php_mode' => 'swoole',  // Fixed to swoole mode only
            'swoole_port' => $swoolePort,
            'swoole_service_name' => $swooleServiceName,
            'swoole_host' => $config['swoole_host'] ?? '0.0.0.0',
            'swoole_workers' => $config['swoole_workers'] ?? 4,
            'ssl_enabled' => $config['ssl_enabled'] ?? false,
            'ssl_provider' => $config['ssl_provider'] ?? 'dnspod',
            'ssl_certificate_id' => $config['ssl_certificate_id'] ?? null,
            'nginx_enabled' => $config['nginx_enabled'] ?? false,
            'nginx_config_file' => ServerManagerV1PathConfig::getNginxSiteConfig($domain),
            'index_file_created' => $config['index_file_created'] ?? false,
            'laravel_info' => $config['laravel_info'] ?? null,
            'created_at' => $config['created_at'] ?? date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
            'status' => $config['status'] ?? 'active',
            'last_deployment' => $config['last_deployment'] ?? null,
            'deployment_count' => ($domains[$domain]['deployment_count'] ?? 0) + 1
        ];

        // Create index.html file if it doesn't exist
        if (!$domainConfig['index_file_created']) {
            $indexCreated = self::createIndexFile($domain, $wwwDir);
            $domainConfig['index_file_created'] = $indexCreated;

            if (!$indexCreated) {
                Log::warning('Failed to create index file, continuing anyway', ['domain' => $domain]);
            }
        }

        // Generate nginx configuration file
        if ($config['nginx_enabled'] ?? false) {
            $nginxResult = self::generateNginxConfig($domain, $domainConfig);
            if (!$nginxResult) {
                Log::error('Failed to generate nginx configuration', ['domain' => $domain]);
                return false;
            }
        }

        // Add or update domain
        $domains[$domain] = $domainConfig;

        if (self::saveDomains($domains)) {
            Log::info('Domain added/updated successfully', [
                'domain' => $domain,
                'type' => $domainConfig['type'],
                'www_dir' => $wwwDir,
                'ssl_enabled' => $domainConfig['ssl_enabled']
            ]);
            return true;
        }

        Log::error('Failed to save domains database', ['domain' => $domain]);
        return false;
    }

    /**
     * Validate domain name format
     */
    private static function validateDomainName(string $domain): bool
    {
        // Check if domain is not empty
        if (empty($domain)) {
            return false;
        }

        // Check length
        if (strlen($domain) > 253) {
            return false;
        }

        // Basic domain format validation
        // Allow letters, numbers, hyphens, dots, and wildcards
        if (!preg_match('/^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/', $domain)) {
            return false;
        }

        return true;
    }
    
    /**
     * Get domain configuration
     */
    public static function getDomain(string $domain): ?array
    {
        $domains = self::loadDomains();
        return $domains[$domain] ?? null;
    }

    /**
     * Get Swoole service name for a domain
     * Returns null if domain doesn't exist or doesn't use Swoole
     *
     * @param string $domain Domain name
     * @return string|null Service name or null
     */
    public static function getDomainOctaneServiceName(string $domain): ?string
    {
        $config = self::getDomain($domain);

        if (!$config) {
            Log::warning('Domain not found', ['domain' => $domain]);
            return null;
        }

        // Return stored service name if available
        if (!empty($config['swoole_service_name'])) {
            return $config['swoole_service_name'];
        }

        // Fallback: Compute service name if we have www_dir and port
        $phpMode = ServerManagerV1PathConfig::normalizePhpMode($config['php_mode'] ?? 'fpm');
        if (ServerManagerV1PathConfig::isSwooleMode($phpMode)) {
            $wwwDir = $config['www_dir'] ?? null;
            $port = $config['swoole_port'] ?? null;

            if ($wwwDir && $port) {
                $serviceName = ServerManagerV1OctaneServiceManager::getOctaneServiceNameFromPath($wwwDir, $port);
                Log::info('Computed service name for domain', [
                    'domain' => $domain,
                    'service_name' => $serviceName,
                    'www_dir' => $wwwDir,
                    'port' => $port
                ]);
                return $serviceName;
            }
        }

        return null;
    }
    
    /**
     * Get all domains
     */
    public static function getAllDomains(): array
    {
        return self::loadDomains();
    }
    
    /**
     * Remove domain
     */
    public static function removeDomain(string $domain): bool
    {
        $domains = self::loadDomains();

        if (!isset($domains[$domain])) {
            return true; // Already removed
        }

        // Check if domain uses Swoole and if we need to stop the service
        $removedConfig = $domains[$domain];
        $phpMode = $removedConfig['php_mode'] ?? 'fpm';
        $wwwDir = $removedConfig['www_dir'] ?? null;
        $swoolePort = $removedConfig['swoole_port'] ?? null;

        $shouldStopService = false;

        if (ServerManagerV1PathConfig::isSwooleMode($phpMode) && $wwwDir && $swoolePort) {
            // Count how many other domains use the same directory with Swoole
            $otherSwooleDomainsCount = 0;

            foreach ($domains as $existingDomain => $existingConfig) {
                if ($existingDomain === $domain) {
                    continue; // Skip the domain being removed
                }

                if (($existingConfig['www_dir'] ?? '') === $wwwDir) {
                    $existingPhpMode = ServerManagerV1PathConfig::normalizePhpMode($existingConfig['php_mode'] ?? 'fpm');
                    if (ServerManagerV1PathConfig::isSwooleMode($existingPhpMode)) {
                        $otherSwooleDomainsCount++;
                    }
                }
            }

            // If this is the last domain using Swoole for this path, stop the service
            if ($otherSwooleDomainsCount === 0) {
                $shouldStopService = true;

                Log::info('Last Swoole domain for path, will stop service', [
                    'domain' => $domain,
                    'www_dir' => $wwwDir,
                    'port' => $swoolePort
                ]);
            } else {
                Log::info('Other domains still using Swoole service, keeping it running', [
                    'domain' => $domain,
                    'www_dir' => $wwwDir,
                    'remaining_domains' => $otherSwooleDomainsCount
                ]);
            }
        }

        // Record history before removal (EXTENDED FEATURE)
        self::recordHistory($domain, 'delete', [
            'removed_config' => $removedConfig
        ]);

        unset($domains[$domain]);

        if (self::saveDomains($domains)) {
            Log::info('Domain removed successfully', ['domain' => $domain]);

            // Stop Swoole service if needed
            if ($shouldStopService && $wwwDir && $swoolePort) {
                try {
                    ServerManagerV1OctaneServiceManager::undeployOctaneServiceFromPath($wwwDir, $swoolePort);
                    Log::info('Swoole service stopped', [
                        'www_dir' => $wwwDir,
                        'port' => $swoolePort
                    ]);
                } catch (\Exception $e) {
                    Log::error('Failed to stop Swoole service', [
                        'www_dir' => $wwwDir,
                        'port' => $swoolePort,
                        'error' => $e->getMessage()
                    ]);
                }
            }

            return true;
        }

        return false;
    }
    
    /**
     * Update domain status
     */
    public static function updateDomainStatus(string $domain, string $status): bool
    {
        $domains = self::loadDomains();
        
        if (!isset($domains[$domain])) {
            Log::error('Domain not found for status update', ['domain' => $domain]);
            return false;
        }
        
        $domains[$domain]['status'] = $status;
        $domains[$domain]['updated_at'] = date('Y-m-d H:i:s');
        
        return self::saveDomains($domains);
    }
    
    /**
     * Record deployment activity
     */
    public static function recordDeployment(string $domain, array $deploymentData): bool
    {
        if (!self::ensureDbDirectory()) {
            return false;
        }
        
        $filePath = self::getDeploymentsFilePath();
        $deployments = [];
        
        // Load existing deployments
        if (file_exists($filePath)) {
            $content = file_get_contents($filePath);
            if ($content !== false) {
                $data = json_decode($content, true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $deployments = $data['deployments'] ?? [];
                }
            }
        }
        
        // Add new deployment record
        $deployment = [
            'id' => uniqid('deploy_'),
            'domain' => $domain,
            'type' => $deploymentData['type'] ?? 'unknown',
            'status' => $deploymentData['status'] ?? 'unknown',
            'nginx_deployed' => $deploymentData['nginx_deployed'] ?? false,
            'ssl_generated' => $deploymentData['ssl_generated'] ?? false,
            'error_message' => $deploymentData['error_message'] ?? null,
            'deployed_at' => date('Y-m-d H:i:s'),
            'deployment_source' => $deploymentData['source'] ?? 'shell_script'
        ];
        
        $deployments[] = $deployment;
        
        // Keep only last 100 deployments
        if (count($deployments) > 100) {
            $deployments = array_slice($deployments, -100);
        }
        
        $data = [
            'version' => '1.0',
            'updated_at' => date('Y-m-d H:i:s'),
            'deployments' => $deployments
        ];
        
        $content = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        
        if (file_put_contents($filePath, $content) === false) {
            Log::error('Failed to save deployments file: ' . $filePath);
            return false;
        }
        
        return true;
    }
    
    /**
     * Get deployment history for domain
     */
    public static function getDeploymentHistory(string $domain, int $limit = 10): array
    {
        $filePath = self::getDeploymentsFilePath();
        
        if (!file_exists($filePath)) {
            return [];
        }
        
        $content = file_get_contents($filePath);
        if ($content === false) {
            return [];
        }
        
        $data = json_decode($content, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return [];
        }
        
        $deployments = $data['deployments'] ?? [];
        
        // Filter by domain and limit results
        $domainDeployments = array_filter($deployments, function($deployment) use ($domain) {
            return $deployment['domain'] === $domain;
        });
        
        // Sort by deployed_at descending and limit
        usort($domainDeployments, function($a, $b) {
            return strtotime($b['deployed_at']) - strtotime($a['deployed_at']);
        });
        
        return array_slice($domainDeployments, 0, $limit);
    }

    /**
     * Create index.html file for domain
     */
    private static function createIndexFile(string $domain, string $wwwDir): bool
    {
        try {
            // Ensure directory exists
            if (!is_dir($wwwDir)) {
                if (!mkdir($wwwDir, 0755, true)) {
                    Log::error('Failed to create www directory', ['domain' => $domain, 'dir' => $wwwDir]);
                    return false;
                }
            }

            $indexFile = $wwwDir . '/index.html';

            // Don't overwrite existing index file
            if (file_exists($indexFile)) {
                return true;
            }

            $htmlContent = self::generateIndexHtml($domain);

            if (file_put_contents($indexFile, $htmlContent) === false) {
                Log::error('Failed to create index.html file', ['domain' => $domain, 'file' => $indexFile]);
                return false;
            }

            Log::info('Index.html file created successfully', ['domain' => $domain, 'file' => $indexFile]);
            return true;

        } catch (\Exception $e) {
            Log::error('Exception creating index file', ['domain' => $domain, 'error' => $e->getMessage()]);
            return false;
        }
    }

    /**
     * Generate HTML content for index page
     */
    private static function generateIndexHtml(string $domain): string
    {
        $timestamp = date('Y-m-d H:i:s');

        return "<!DOCTYPE html>
<html lang=\"en\">
<head>
    <meta charset=\"UTF-8\">
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
    <title>Welcome to $domain</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            padding: 3rem;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 500px;
            margin: 2rem;
        }
        h1 {
            color: #333;
            margin-bottom: 1rem;
            font-size: 2.5rem;
        }
        .domain {
            color: #667eea;
            font-weight: bold;
        }
        .status {
            background: #10b981;
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 25px;
            display: inline-block;
            margin: 1rem 0;
            font-weight: 500;
        }
        .info {
            color: #666;
            margin-top: 2rem;
            font-size: 0.9rem;
        }
        .powered-by {
            margin-top: 2rem;
            padding-top: 2rem;
            border-top: 1px solid #eee;
            color: #999;
            font-size: 0.8rem;
        }
    </style>
</head>
<body>
    <div class=\"container\">
        <h1>🎉 Welcome!</h1>
        <p>Your domain <span class=\"domain\">$domain</span> is now active and ready to use.</p>
        <div class=\"status\">✅ Website Successfully Deployed</div>
        <div class=\"info\">
            <p><strong>Deployment Information:</strong></p>
            <p>📅 Deployed: $timestamp</p>
            <p>🌐 Domain: $domain</p>
            <p>🔧 Managed by ServerManagerV1</p>
        </div>
        <div class=\"powered-by\">
            Powered by Laravel ServerManagerV1<br>
            Nginx + PHP + SSL Certificate Management
        </div>
    </div>
</body>
</html>";
    }

    /**
     * Get domains summary with detailed information
     */
    public static function getDomainsSummary(): array
    {
        $domains = self::loadDomains();
        $summary = [
            'total_domains' => count($domains),
            'active_domains' => 0,
            'ssl_enabled_domains' => 0,
            'nginx_enabled_domains' => 0,
            'laravel_domains' => 0,
            'static_domains' => 0,
            'php_versions' => [],
            'domains' => []
        ];

        foreach ($domains as $domain => $config) {
            if ($config['status'] === 'active') {
                $summary['active_domains']++;
            }

            if ($config['ssl_enabled']) {
                $summary['ssl_enabled_domains']++;
            }

            if ($config['nginx_enabled']) {
                $summary['nginx_enabled_domains']++;
            }

            if ($config['type'] === 'laravel') {
                $summary['laravel_domains']++;
            } elseif ($config['type'] === 'static') {
                $summary['static_domains']++;
            }

            // Track PHP versions
            $phpVersion = $config['php_version'];
            if (!isset($summary['php_versions'][$phpVersion])) {
                $summary['php_versions'][$phpVersion] = 0;
            }
            $summary['php_versions'][$phpVersion]++;

            $summary['domains'][] = [
                'domain' => $domain,
                'type' => $config['type'],
                'status' => $config['status'],
                'ssl_enabled' => $config['ssl_enabled'],
                'nginx_enabled' => $config['nginx_enabled'],
                'php_version' => $config['php_version'],
                'created_at' => $config['created_at'],
                'deployment_count' => $config['deployment_count'] ?? 0
            ];
        }

        return $summary;
    }

    /**
     * Link domain to certificate
     */
    public static function linkDomainToCertificate(string $domain, string $certificateId): bool
    {
        $domains = self::loadDomains();

        if (!isset($domains[$domain])) {
            Log::error('Domain not found for certificate linking', ['domain' => $domain]);
            return false;
        }

        $domains[$domain]['ssl_certificate_id'] = $certificateId;
        $domains[$domain]['ssl_enabled'] = true;
        $domains[$domain]['updated_at'] = date('Y-m-d H:i:s');

        return self::saveDomains($domains);
    }

    /**
     * Generate nginx configuration file for domain
     */
    private static function generateNginxConfig(string $domain, array $config): bool
    {
        // AI DEVELOPERS: Always use ServerManagerV1PathConfig constants for paths!
        // Use PathMapper methods instead of deprecated constants (no hardcoded paths)
        $nginxConfigDir = ServerManagerV1PathConfig::getNginxSitesAvailable();
        $nginxEnabledDir = ServerManagerV1PathConfig::getNginxSitesEnabled();

        // Create directories if they don't exist
        if (!is_dir($nginxConfigDir)) {
            if (!mkdir($nginxConfigDir, 0755, true)) {
                Log::error('Failed to create nginx config directory', [
                    'domain' => $domain,
                    'directory' => $nginxConfigDir
                ]);
                return false;
            }
        }
        if (!is_dir($nginxEnabledDir)) {
            if (!mkdir($nginxEnabledDir, 0755, true)) {
                Log::error('Failed to create nginx enabled directory', [
                    'domain' => $domain,
                    'directory' => $nginxEnabledDir
                ]);
                return false;
            }
        }

        $configFile = ServerManagerV1PathConfig::getNginxSiteConfig($domain, false);
        $enabledFile = ServerManagerV1PathConfig::getNginxEnabledSite($domain);
        $sslConfigFile = ServerManagerV1PathConfig::getNginxSiteConfig($domain, true);

        // Clean up existing files and links
        self::cleanupNginxFiles($domain, $nginxConfigDir, $nginxEnabledDir);

        // Determine document root based on website type
        $documentRoot = $config['www_dir'];
        if ($config['type'] === 'poly') {
            $documentRoot = $config['www_dir'] . '/public';
        } elseif ($config['type'] === 'laravel') {
            $documentRoot = $config['www_dir'] . '/public';
        }

        // Prepare server names (include all domains)
        $allDomains = $config['all_domains'] ?? [$domain];
        $serverNames = implode(' ', $allDomains);

        // Prepare SSL certificate paths if enabled
        $sslEnabled = $config['ssl_enabled'] && !empty($config['ssl_certificate_id']);
        $certDir = null;

        if ($sslEnabled) {
            $certificate = ServerManagerV1CertificateManager::findCertificateForDomain($domain);
            if ($certificate && isset($certificate['base_domain'])) {
                $baseDomain = $certificate['base_domain'];
                $certDir = ServerManagerV1PathConfig::getSslCertDir($baseDomain);
            } else {
                $baseDomain = self::extractBaseDomain($domain);
                $certDir = ServerManagerV1PathConfig::getSslCertDir($baseDomain);
            }

            $fullchainPath = "$certDir/fullchain.pem";
            $privkeyPath = "$certDir/privkey.pem";

            if (!file_exists($fullchainPath) || !file_exists($privkeyPath)) {
                Log::warning('SSL certificate files not found, they should be created before nginx restart', [
                    'domain' => $domain,
                    'base_domain' => $baseDomain,
                    'cert_dir' => $certDir,
                    'fullchain_exists' => file_exists($fullchainPath),
                    'privkey_exists' => file_exists($privkeyPath)
                ]);
            }
        }

        // Generate PHP configuration for Laravel/PHP sites (swoole mode only)
        $phpConfig = '';
        // Fixed to swoole mode only - no longer configurable
        $phpMode = 'swoole';

        if ($config['type'] === 'proxy') {
            // Proxy mode: Reverse proxy to specified port
            $proxyPort = $config['proxy_port'] ?? 8000;
            $phpConfig = "
    # Reverse Proxy Configuration
    location / {
        proxy_pass http://127.0.0.1:$proxyPort;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # WebSocket support
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass \$http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }";
        } elseif (in_array($config['type'], ['laravel', 'poly', 'php'])) {
            // Always use Swoole mode (Octane): Reverse proxy configuration
            // Auto-calculate port based on app index instead of using cached value
            $wwwDir = $config['www_dir'] ?? '';
            $swoolePort = $wwwDir
                ? ServerManagerV1OctaneServiceManager::getPortFromPathHash($wwwDir)
                : ($config['swoole_port'] ?? 8000);
            $phpConfig = "
    # Swoole/Octane Reverse Proxy (Fixed Mode)
    index index.php index.html index.htm;

    location / {
        try_files \$uri @swoole;
    }

    location @swoole {
        proxy_pass http://127.0.0.1:$swoolePort;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # WebSocket support
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass \$http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static files handled by Nginx
    location ~* \\.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot|webp|mp4|mp3|pdf)\$ {
        try_files \$uri =404;
        expires 1y;
        add_header Cache-Control \"public, immutable\";
    }

    # Deny access to sensitive files
    location ~ /\\. {
        deny all;
    }

    location ~ /(storage|bootstrap/cache) {
        deny all;
    }";
        }

        // Generate base HTTP configuration
        $httpConfig = "# HTTP configuration for $domain
# Generated by ServerManagerV1 at " . date('Y-m-d H:i:s') . "

server {
    listen 80;
    listen [::]:80;
    server_name $serverNames;

    root $documentRoot;$phpConfig

    # Security headers
    add_header X-Frame-Options \"SAMEORIGIN\" always;
    add_header X-Content-Type-Options \"nosniff\" always;
    add_header X-XSS-Protection \"1; mode=block\" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Static files caching
    location ~* \\.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf|svg)\$ {
        expires 1y;
        add_header Cache-Control \"public, immutable\";
    }

    # Deny access to hidden files
    location ~ /\\. {
        deny all;
    }

    # Error and access logs
    error_log /var/log/nginx/$domain.error.log;
    access_log /var/log/nginx/$domain.access.log;
}";

        if ($sslEnabled) {
            // Generate HTTP redirect configuration
            $httpRedirectConfig = "# HTTP to HTTPS redirect for $domain
# Generated by ServerManagerV1 at " . date('Y-m-d H:i:s') . "

server {
    listen 80;
    listen [::]:80;
    server_name $serverNames;
    return 301 https://\$server_name\$request_uri;
}";

            // Generate SSL configuration as separate file
            $sslConfig = "# HTTPS configuration for $domain
# Generated by ServerManagerV1 at " . date('Y-m-d H:i:s') . "

# HTTPS server block
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $serverNames;

    root $documentRoot;

    # SSL Configuration
    ssl_certificate $certDir/fullchain.pem;
    ssl_certificate_key $certDir/privkey.pem;

    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # HSTS (HTTP Strict Transport Security)
    add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always;$phpConfig

    # Security headers
    add_header X-Frame-Options \"SAMEORIGIN\" always;
    add_header X-Content-Type-Options \"nosniff\" always;
    add_header X-XSS-Protection \"1; mode=block\" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Static files caching
    location ~* \\.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf|svg)\$ {
        expires 1y;
        add_header Cache-Control \"public, immutable\";
    }

    # Deny access to hidden files
    location ~ /\\. {
        deny all;
    }

    # Error and access logs
    error_log /var/log/nginx/$domain.error.log;
    access_log /var/log/nginx/$domain.access.log;
}";

            // Write HTTP redirect configuration to main config file
            $httpResult = file_put_contents($configFile, $httpRedirectConfig);
            if ($httpResult === false) {
                Log::error('Failed to write HTTP redirect config file', [
                    'domain' => $domain,
                    'config_file' => $configFile
                ]);
                return false;
            }

            // Write SSL configuration file
            $sslResult = file_put_contents($sslConfigFile, $sslConfig);
            if ($sslResult === false) {
                Log::error('Failed to write SSL config file', [
                    'domain' => $domain,
                    'ssl_config_file' => $sslConfigFile
                ]);
                return false;
            }

            // Create symbolic links for BOTH HTTP redirect and HTTPS
            // HTTP redirect link (for port 80)
            $httpEnabledFile = $enabledFile;  // e.g., /sites-enabled/domain.com

            // Remove existing symlink if it exists
            if (file_exists($httpEnabledFile) || is_link($httpEnabledFile)) {
                @unlink($httpEnabledFile);
            }
            $httpSymlinkResult = symlink($configFile, $httpEnabledFile);
            if (!$httpSymlinkResult) {
                Log::error('Failed to create HTTP symlink', [
                    'domain' => $domain,
                    'source' => $configFile,
                    'target' => $httpEnabledFile
                ]);
                return false;
            }

            // HTTPS link (for port 443)
            $sslEnabledFile = "$enabledFile-ssl";  // e.g., /sites-enabled/domain.com-ssl

            // Remove existing symlink if it exists
            if (file_exists($sslEnabledFile) || is_link($sslEnabledFile)) {
                @unlink($sslEnabledFile);
            }
            $sslSymlinkResult = symlink($sslConfigFile, $sslEnabledFile);
            if (!$sslSymlinkResult) {
                Log::error('Failed to create SSL symlink', [
                    'domain' => $domain,
                    'source' => $sslConfigFile,
                    'target' => $sslEnabledFile
                ]);
                return false;
            }

            return true;
        } else {
            // Write HTTP configuration file
            $httpResult = file_put_contents($configFile, $httpConfig);
            if ($httpResult === false) {
                Log::error('Failed to write HTTP config file', [
                    'domain' => $domain,
                    'config_file' => $configFile
                ]);
                return false;
            }

            // Remove existing symlink if it exists
            if (file_exists($enabledFile) || is_link($enabledFile)) {
                @unlink($enabledFile);
            }

            // Create symbolic link to enable HTTP configuration
            $symlinkResult = symlink($configFile, $enabledFile);
            if (!$symlinkResult) {
                Log::error('Failed to create HTTP symlink', [
                    'domain' => $domain,
                    'source' => $configFile,
                    'target' => $enabledFile
                ]);
                return false;
            }

            return true;
        }
    }

    /**
     * Clean up existing nginx configuration files and links for a domain
     */
    private static function cleanupNginxFiles(string $domain, string $configDir, string $enabledDir): void
    {
        $configFile = "$configDir/$domain";
        $sslConfigFile = "$configDir/$domain-ssl";
        $enabledFile = "$enabledDir/$domain";

        // Remove enabled link first (it might be a symlink)
        if (file_exists($enabledFile) || is_link($enabledFile)) {
            unlink($enabledFile);
        }

        // Remove configuration files
        if (file_exists($configFile)) {
            unlink($configFile);
        }

        if (file_exists($sslConfigFile)) {
            unlink($sslConfigFile);
        }

        // Also check for any other potential config files
        $patterns = [
            "$configDir/$domain.*",
            "$enabledDir/$domain.*"
        ];

        foreach ($patterns as $pattern) {
            $files = glob($pattern);
            if ($files) {
                foreach ($files as $file) {
                    if (file_exists($file) || is_link($file)) {
                        unlink($file);
                    }
                }
            }
        }
    }

    /**
     * Synchronize all nginx configurations based on domain database
     * This function cleans up old configurations and regenerates all active ones
     *
     * AI DEVELOPERS: Use this function to clean up configuration inconsistencies
     * and ensure all nginx configs match the domain database state
     */
    public static function syncAllNginxConfigurations(): array
    {
        $results = [
            'cleaned_files' => [],
            'generated_configs' => [],
            'errors' => []
        ];

        try {
            // Step 1: Load all domains from database
            $domains = self::loadDomains();
            $activeDomains = [];

            foreach ($domains as $domain => $config) {
                if ($config['status'] === 'active') {
                    $activeDomains[] = $domain;
                }
            }

            // Step 2: Clean up all existing nginx configurations. Use the PathMapper-backed
            // getters (not the deprecated NGINX_SITES_AVAILABLE/ENABLED consts which hardcode
            // /www/nginxconfig and don't exist on non-/www hosts -> cleanup silently no-ops).
            $nginxConfigDir = ServerManagerV1PathConfig::getNginxSitesAvailable();
            $nginxEnabledDir = ServerManagerV1PathConfig::getNginxSitesEnabled();

            // Get all existing config files
            $existingConfigs = [];
            if (is_dir($nginxConfigDir)) {
                $files = glob($nginxConfigDir . '/*');
                foreach ($files as $file) {
                    if (is_file($file) && basename($file) !== 'default') {
                        $existingConfigs[] = $file;
                    }
                }
            }

            // Get all existing enabled links
            $existingEnabled = [];
            if (is_dir($nginxEnabledDir)) {
                $files = glob($nginxEnabledDir . '/*');
                foreach ($files as $file) {
                    if ((is_file($file) || is_link($file)) && basename($file) !== 'default') {
                        $existingEnabled[] = $file;
                    }
                }
            }

            // Remove all non-default configurations
            foreach ($existingConfigs as $file) {
                if (unlink($file)) {
                    $results['cleaned_files'][] = $file;
                }
            }

            foreach ($existingEnabled as $file) {
                if (unlink($file)) {
                    $results['cleaned_files'][] = $file;
                }
            }

            // Step 3: Regenerate configurations for all active domains
            foreach ($domains as $domain => $config) {
                if ($config['status'] === 'active' && ($config['nginx_enabled'] ?? false)) {
                    try {
                        if (self::generateNginxConfig($domain, $config)) {
                            $results['generated_configs'][] = $domain;
                        } else {
                            $results['errors'][] = "Failed to generate config for: $domain";
                        }
                    } catch (\Exception $e) {
                        $results['errors'][] = "Error generating config for $domain: " . $e->getMessage();
                    }
                }
            }

            Log::info('Nginx configurations synchronized', $results);

        } catch (\Exception $e) {
            $results['errors'][] = "Sync failed: " . $e->getMessage();
            Log::error('Failed to sync nginx configurations', ['error' => $e->getMessage()]);
        }

        return $results;
    }

    /**
     * Get nginx sync status
     * Analyzes current nginx configurations and compares with database
     *
     * AI DEVELOPERS: Use this to check configuration consistency
     *
     * @return array Status information with counts and lists
     */
    public static function getNginxSyncStatus(): array
    {
        $domains = self::loadDomains();
        // Use PathMapper methods instead of deprecated constants (no hardcoded paths)
        $nginxConfigDir = ServerManagerV1PathConfig::getNginxSitesAvailable();
        $nginxEnabledDir = ServerManagerV1PathConfig::getNginxSitesEnabled();

        $status = [
            'domains_in_db' => count($domains),
            'active_domains' => 0,
            'nginx_enabled_domains' => 0,
            'config_files_exist' => 0,
            'enabled_links_exist' => 0,
            'orphaned_configs' => [],
            'missing_configs' => [],
            'nginx_only_domains' => []
        ];

        $dbDomains = [];
        $nginxEnabledDomains = [];

        foreach ($domains as $domain => $config) {
            if ($config['status'] === 'active') {
                $status['active_domains']++;
            }

            if ($config['nginx_enabled'] ?? false) {
                $status['nginx_enabled_domains']++;
                $nginxEnabledDomains[] = $domain;
            }

            $dbDomains[$domain] = $config;
        }

        if (is_dir($nginxConfigDir)) {
            $files = glob($nginxConfigDir . '/*');
            $nginxConfigs = [];

            foreach ($files as $file) {
                $filename = basename($file);

                if (is_file($file) && $filename !== 'default' && $filename !== 'ssl-challenges') {
                    $nginxConfigs[] = $filename;
                    $status['config_files_exist']++;

                    if (!isset($dbDomains[$filename])) {
                        $status['orphaned_configs'][] = $filename;
                    }
                }
            }

            foreach ($nginxEnabledDomains as $domain) {
                $configPath = $nginxConfigDir . '/' . $domain;
                if (!file_exists($configPath)) {
                    $status['missing_configs'][] = $domain;
                }
            }
        }

        if (is_dir($nginxEnabledDir)) {
            $files = glob($nginxEnabledDir . '/*');
            foreach ($files as $file) {
                $filename = basename($file);
                if ((is_file($file) || is_link($file)) && $filename !== 'default' && $filename !== 'ssl-challenges') {
                    $status['enabled_links_exist']++;
                }
            }
        }

        return $status;
    }

    /**
     * Parse nginx configuration file
     * Extracts domain information from nginx config
     *
     * @param string $configPath Path to nginx config file
     * @return array|null Parsed configuration or null on failure
     */
    public static function parseNginxConfig(string $configPath): ?array
    {
        if (!file_exists($configPath) || !is_readable($configPath)) {
            return null;
        }

        $content = file_get_contents($configPath);
        if ($content === false) {
            return null;
        }

        $config = [
            'domain' => basename($configPath),
            'server_names' => [],
            'root' => null,
            'ssl_enabled' => false,
            'php_version' => null,
            'type' => 'html',
            'listen_ports' => [],
            'ssl_certificate' => null,
            'ssl_certificate_key' => null
        ];

        $lines = explode("\n", $content);

        foreach ($lines as $line) {
            $line = trim($line);

            if (preg_match('/^\s*server_name\s+([^;]+);/', $line, $matches)) {
                $serverNames = preg_split('/\s+/', trim($matches[1]));
                $config['server_names'] = array_merge($config['server_names'], $serverNames);
            }

            if (preg_match('/^\s*root\s+([^;]+);/', $line, $matches)) {
                $config['root'] = trim($matches[1]);
            }

            if (preg_match('/^\s*listen\s+(\d+)\s+ssl/', $line, $matches) ||
                preg_match('/^\s*listen\s+\[::\]:(\d+)\s+ssl/', $line, $matches)) {
                $config['ssl_enabled'] = true;
            }

            if (preg_match('/^\s*listen\s+(\d+)/', $line, $matches)) {
                $port = $matches[1];
                if (!in_array($port, $config['listen_ports'])) {
                    $config['listen_ports'][] = $port;
                }
            }

            if (preg_match('/^\s*ssl_certificate\s+([^;]+);/', $line, $matches)) {
                $config['ssl_certificate'] = trim($matches[1]);
            }

            if (preg_match('/^\s*ssl_certificate_key\s+([^;]+);/', $line, $matches)) {
                $config['ssl_certificate_key'] = trim($matches[1]);
            }

            if (preg_match('/php([\d.]+)-fpm\.sock/', $line, $matches)) {
                $config['php_version'] = $matches[1];
            }

            if (strpos($line, 'try_files $uri $uri/ /index.php') !== false) {
                $config['type'] = 'laravel';
            }
        }

        if (strpos($config['root'], '/poly_apps/laravel_main') !== false) {
            $config['type'] = 'poly';
        }

        return $config;
    }

    /**
     * Sync from nginx configurations to database
     * Imports nginx configurations into domain database
     *
     * AI DEVELOPERS: Use this to import existing nginx configs
     *
     * @param array $options Options: merge (bool), overwrite (bool), dry_run (bool)
     * @return array Results with imported domains and errors
     */
    public static function syncFromNginx(array $options = []): array
    {
        $merge = $options['merge'] ?? true;
        $overwrite = $options['overwrite'] ?? false;
        $dryRun = $options['dry_run'] ?? false;

        $results = [
            'scanned_files' => 0,
            'imported_domains' => [],
            'skipped_domains' => [],
            'updated_domains' => [],
            'errors' => []
        ];

        $nginxConfigDir = ServerManagerV1PathConfig::getNginxSitesAvailable();

        if (!is_dir($nginxConfigDir)) {
            $results['errors'][] = "Nginx config directory not found: $nginxConfigDir";
            return $results;
        }

        $existingDomains = self::loadDomains();
        $files = glob($nginxConfigDir . '/*');

        foreach ($files as $file) {
            $filename = basename($file);

            if (!is_file($file) || $filename === 'default' || $filename === 'ssl-challenges') {
                continue;
            }

            $results['scanned_files']++;

            $parsedConfig = self::parseNginxConfig($file);
            if (!$parsedConfig) {
                $results['errors'][] = "Failed to parse: $filename";
                continue;
            }

            $domain = $parsedConfig['domain'];

            if (isset($existingDomains[$domain])) {
                if (!$overwrite && $merge) {
                    $results['skipped_domains'][] = [
                        'domain' => $domain,
                        'reason' => 'Already exists in database'
                    ];
                    continue;
                } elseif ($overwrite) {
                    if (!$dryRun) {
                        $config = array_merge($existingDomains[$domain], [
                            'www_dir' => $parsedConfig['root'],
                            'php_version' => $parsedConfig['php_version'] ?? $existingDomains[$domain]['php_version'],
                            'ssl_enabled' => $parsedConfig['ssl_enabled'],
                            'type' => $parsedConfig['type'] ?? $existingDomains[$domain]['type'],
                            'nginx_enabled' => true,
                            'updated_at' => date('Y-m-d H:i:s')
                        ]);

                        if (self::updateDomain($domain, $config)) {
                            $results['updated_domains'][] = $domain;
                        }
                    } else {
                        $results['updated_domains'][] = $domain;
                    }
                    continue;
                }
            }

            if (!$dryRun) {
                $config = [
                    'domain' => $domain,
                    'type' => $parsedConfig['type'] ?? 'html',
                    // Use PathMapper for environment-aware path (no hardcoded paths)
                    'www_dir' => $parsedConfig['root'] ?? PathMapper::mapWebPath('wwwroot') . '/' . $domain,
                    'php_version' => $parsedConfig['php_version'] ?? '8.4',
                    'ssl_enabled' => $parsedConfig['ssl_enabled'],
                    'nginx_enabled' => true,
                    'nginx_config_file' => $filename,
                    'status' => 'active',
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s'),
                    'imported_from_nginx' => true,
                    'ssl_certificate' => $parsedConfig['ssl_certificate'] ?? null,
                    'ssl_certificate_key' => $parsedConfig['ssl_certificate_key'] ?? null
                ];

                if (self::addDomain($domain, $config)) {
                    $results['imported_domains'][] = $domain;
                } else {
                    $results['errors'][] = "Failed to import: $domain";
                }
            } else {
                $results['imported_domains'][] = $domain;
            }
        }

        if (!$dryRun) {
            Log::info('Synced from nginx', $results);
        }

        return $results;
    }

    /**
     * Collect nginx information (standalone inspection)
     * Returns detailed information about all nginx configurations
     *
     * AI DEVELOPERS: Use this to inspect nginx configurations without modifying database
     *
     * @return array Detailed nginx configuration information
     */
    public static function collectNginxInfo(): array
    {
        // Use PathMapper methods instead of deprecated constants (no hardcoded paths)
        $nginxConfigDir = ServerManagerV1PathConfig::getNginxSitesAvailable();
        $nginxEnabledDir = ServerManagerV1PathConfig::getNginxSitesEnabled();

        $info = [
            'nginx_config_dir' => $nginxConfigDir,
            'nginx_enabled_dir' => $nginxEnabledDir,
            'total_configs' => 0,
            'enabled_configs' => 0,
            'configurations' => [],
            'enabled_sites' => [],
            'summary' => [
                'by_type' => [],
                'by_ssl' => ['enabled' => 0, 'disabled' => 0],
                'by_php_version' => []
            ]
        ];

        if (!is_dir($nginxConfigDir)) {
            $info['error'] = "Nginx config directory not found: $nginxConfigDir";
            return $info;
        }

        $files = glob($nginxConfigDir . '/*');

        foreach ($files as $file) {
            $filename = basename($file);

            if (!is_file($file) || $filename === 'default' || $filename === 'ssl-challenges') {
                continue;
            }

            $info['total_configs']++;

            $parsedConfig = self::parseNginxConfig($file);
            if (!$parsedConfig) {
                continue;
            }

            $isEnabled = is_link($nginxEnabledDir . '/' . $filename) ||
                         file_exists($nginxEnabledDir . '/' . $filename);

            if ($isEnabled) {
                $info['enabled_configs']++;
                $info['enabled_sites'][] = $filename;
            }

            $configInfo = [
                'domain' => $parsedConfig['domain'],
                'server_names' => $parsedConfig['server_names'],
                'root' => $parsedConfig['root'],
                'type' => $parsedConfig['type'],
                'ssl_enabled' => $parsedConfig['ssl_enabled'],
                'php_version' => $parsedConfig['php_version'],
                'enabled' => $isEnabled,
                'config_file' => $file,
                'listen_ports' => $parsedConfig['listen_ports'],
                'file_size' => filesize($file),
                'modified_time' => date('Y-m-d H:i:s', filemtime($file))
            ];

            $info['configurations'][] = $configInfo;

            $type = $parsedConfig['type'] ?? 'unknown';
            if (!isset($info['summary']['by_type'][$type])) {
                $info['summary']['by_type'][$type] = 0;
            }
            $info['summary']['by_type'][$type]++;

            if ($parsedConfig['ssl_enabled']) {
                $info['summary']['by_ssl']['enabled']++;
            } else {
                $info['summary']['by_ssl']['disabled']++;
            }

            if ($parsedConfig['php_version']) {
                $phpVer = $parsedConfig['php_version'];
                if (!isset($info['summary']['by_php_version'][$phpVer])) {
                    $info['summary']['by_php_version'][$phpVer] = 0;
                }
                $info['summary']['by_php_version'][$phpVer]++;
            }
        }

        return $info;
    }

    // ========================================
    // EXTENDED FEATURES - Domain Conflict Detection & Management
    // ========================================

    /**
     * Check if domain exists in any site
     *
     * @param string $domain Domain to check
     * @return array|null Returns domain config if exists, null otherwise
     */
    public static function checkDomainConflict(string $domain): ?array
    {
        $domains = self::loadDomains();

        if (isset($domains[$domain])) {
            return [
                'exists' => true,
                'domain' => $domain,
                'config' => $domains[$domain],
                'type' => $domains[$domain]['type'],
                'www_dir' => $domains[$domain]['www_dir'],
                'status' => $domains[$domain]['status']
            ];
        }

        return null;
    }

    /**
     * Find all domains using the same www_dir (same site)
     *
     * @param string $wwwDir Web directory path
     * @return array List of domains using this directory
     */
    public static function findSitesByDirectory(string $wwwDir): array
    {
        $domains = self::loadDomains();
        $sites = [];

        foreach ($domains as $domain => $config) {
            if ($config['www_dir'] === $wwwDir) {
                $sites[] = [
                    'domain' => $domain,
                    'type' => $config['type'],
                    'status' => $config['status'],
                    'ssl_enabled' => $config['ssl_enabled'] ?? false,
                    'created_at' => $config['created_at'] ?? null
                ];
            }
        }

        return $sites;
    }

    /**
     * Check if domain can be safely removed
     *
     * @param string $domain Domain to check
     * @return array Analysis result with recommendations
     */
    public static function canRemoveDomain(string $domain): array
    {
        $config = self::getDomain($domain);

        if (!$config) {
            return [
                'can_remove' => false,
                'exists' => false,
                'reason' => 'Domain not found'
            ];
        }

        // Check if there are other domains on the same site
        $sameSiteDomains = self::findSitesByDirectory($config['www_dir']);
        $isLastDomain = count($sameSiteDomains) === 1;

        return [
            'can_remove' => true,
            'exists' => true,
            'domain' => $domain,
            'same_site_domains' => $sameSiteDomains,
            'is_last_domain' => $isLastDomain,
            'should_disable_site' => $isLastDomain,
            'www_dir' => $config['www_dir'],
            'warning' => $isLastDomain
                ? 'This is the last domain for this site. Removing it will leave the site without any domain.'
                : null,
            'recommendation' => $isLastDomain
                ? 'Consider disabling the site instead of removing the domain, or ensure files are backed up.'
                : 'Safe to remove. Site has other domains.'
        ];
    }

    // ========================================
    // EXTENDED FEATURES - Site Enable/Disable
    // ========================================

    /**
     * Disable site (remove nginx config links, keep files)
     *
     * @param string $domain Domain to disable
     * @param array $options Options: preserve_config, reason
     * @return bool Success status
     */
    public static function disableSite(string $domain, array $options = []): bool
    {
        $config = self::getDomain($domain);

        if (!$config) {
            Log::error('Cannot disable site: domain not found', ['domain' => $domain]);
            return false;
        }

        try {
            // Remove nginx enabled link (but keep config file)
            $enabledFile = ServerManagerV1PathConfig::getNginxEnabledSite($domain);
            if (file_exists($enabledFile) || is_link($enabledFile)) {
                if (!unlink($enabledFile)) {
                    Log::error('Failed to remove nginx enabled link', ['file' => $enabledFile]);
                    return false;
                }
                Log::info('Removed nginx enabled link', ['domain' => $domain, 'file' => $enabledFile]);
            }

            // Update domain status
            $domains = self::loadDomains();
            $domains[$domain]['status'] = 'disabled';
            $domains[$domain]['nginx_enabled'] = false;
            $domains[$domain]['disabled_at'] = date('Y-m-d H:i:s');
            $domains[$domain]['disable_reason'] = $options['reason'] ?? 'Manually disabled';
            $domains[$domain]['updated_at'] = date('Y-m-d H:i:s');

            if (self::saveDomains($domains)) {
                Log::info('Site disabled successfully', [
                    'domain' => $domain,
                    'reason' => $options['reason'] ?? 'Manual'
                ]);
                return true;
            }

            return false;

        } catch (\Exception $e) {
            Log::error('Failed to disable site', [
                'domain' => $domain,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Enable site (create nginx config link)
     *
     * @param string $domain Domain to enable
     * @return bool Success status
     */
    public static function enableSite(string $domain): bool
    {
        $config = self::getDomain($domain);

        if (!$config) {
            Log::error('Cannot enable site: domain not found', ['domain' => $domain]);
            return false;
        }

        try {
            // Regenerate nginx configuration
            if (!self::generateNginxConfig($domain, $config)) {
                Log::error('Failed to generate nginx config', ['domain' => $domain]);
                return false;
            }

            // Update domain status
            $domains = self::loadDomains();
            $domains[$domain]['status'] = 'active';
            $domains[$domain]['nginx_enabled'] = true;
            $domains[$domain]['enabled_at'] = date('Y-m-d H:i:s');
            $domains[$domain]['updated_at'] = date('Y-m-d H:i:s');
            unset($domains[$domain]['disabled_at']);
            unset($domains[$domain]['disable_reason']);

            if (self::saveDomains($domains)) {
                Log::info('Site enabled successfully', ['domain' => $domain]);
                return true;
            }

            return false;

        } catch (\Exception $e) {
            Log::error('Failed to enable site', [
                'domain' => $domain,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    // ========================================
    // EXTENDED FEATURES - Domain Search & Query
    // ========================================

    /**
     * Search domains by criteria
     *
     * @param array $criteria Search criteria: type, status, ssl_enabled, php_version, search_term
     * @return array Matching domains
     */
    public static function searchDomains(array $criteria): array
    {
        $domains = self::loadDomains();
        $results = [];

        foreach ($domains as $domain => $config) {
            $match = true;

            // Filter by type
            if (isset($criteria['type']) && $config['type'] !== $criteria['type']) {
                $match = false;
            }

            // Filter by status
            if (isset($criteria['status']) && $config['status'] !== $criteria['status']) {
                $match = false;
            }

            // Filter by SSL enabled
            if (isset($criteria['ssl_enabled']) && ($config['ssl_enabled'] ?? false) !== $criteria['ssl_enabled']) {
                $match = false;
            }

            // Filter by PHP version
            if (isset($criteria['php_version']) && $config['php_version'] !== $criteria['php_version']) {
                $match = false;
            }

            // Filter by search term (domain name, www_dir)
            if (isset($criteria['search_term'])) {
                $searchTerm = strtolower($criteria['search_term']);
                $domainLower = strtolower($domain);
                $wwwDirLower = strtolower($config['www_dir']);

                if (strpos($domainLower, $searchTerm) === false &&
                    strpos($wwwDirLower, $searchTerm) === false) {
                    $match = false;
                }
            }

            if ($match) {
                $results[$domain] = $config;
            }
        }

        return $results;
    }

    /**
     * Get domains grouped by directory (sites with multiple domains)
     *
     * @return array Domains grouped by www_dir
     */
    public static function getDomainsGroupedBySite(): array
    {
        $domains = self::loadDomains();
        $grouped = [];

        foreach ($domains as $domain => $config) {
            $wwwDir = $config['www_dir'];

            if (!isset($grouped[$wwwDir])) {
                $grouped[$wwwDir] = [
                    'www_dir' => $wwwDir,
                    'type' => $config['type'],
                    'domains' => []
                ];
            }

            $grouped[$wwwDir]['domains'][] = [
                'domain' => $domain,
                'status' => $config['status'],
                'ssl_enabled' => $config['ssl_enabled'] ?? false,
                'created_at' => $config['created_at'] ?? null
            ];
        }

        return $grouped;
    }

    // ========================================
    // EXTENDED FEATURES - Batch Operations
    // ========================================

    /**
     * Batch enable domains
     *
     * @param array $domains List of domain names
     * @return array Results with success/failure for each domain
     */
    public static function batchEnableSites(array $domains): array
    {
        $results = [
            'success' => [],
            'failed' => [],
            'total' => count($domains)
        ];

        foreach ($domains as $domain) {
            if (self::enableSite($domain)) {
                $results['success'][] = $domain;
            } else {
                $results['failed'][] = $domain;
            }
        }

        return $results;
    }

    /**
     * Batch disable domains
     *
     * @param array $domains List of domain names
     * @param array $options Options: reason
     * @return array Results with success/failure for each domain
     */
    public static function batchDisableSites(array $domains, array $options = []): array
    {
        $results = [
            'success' => [],
            'failed' => [],
            'total' => count($domains)
        ];

        foreach ($domains as $domain) {
            if (self::disableSite($domain, $options)) {
                $results['success'][] = $domain;
            } else {
                $results['failed'][] = $domain;
            }
        }

        return $results;
    }

    /**
     * Batch update domain configurations
     *
     * @param array $updates Map of domain => config updates
     * @return array Results
     */
    public static function batchUpdateDomains(array $updates): array
    {
        $domains = self::loadDomains();
        $results = [
            'success' => [],
            'failed' => [],
            'total' => count($updates)
        ];

        foreach ($updates as $domain => $configUpdates) {
            if (!isset($domains[$domain])) {
                $results['failed'][$domain] = 'Domain not found';
                continue;
            }

            // Merge updates into existing config
            $domains[$domain] = array_merge($domains[$domain], $configUpdates);
            $domains[$domain]['updated_at'] = date('Y-m-d H:i:s');
            $results['success'][] = $domain;
        }

        if (self::saveDomains($domains)) {
            Log::info('Batch update completed', $results);
            return $results;
        }

        $results['error'] = 'Failed to save domains database';
        return $results;
    }

    // ========================================
    // EXTENDED FEATURES - Domain History
    // ========================================

    /**
     * Record domain history entry
     *
     * @param string $domain Domain name
     * @param string $action Action performed
     * @param array $details Additional details
     * @return bool Success status
     */
    public static function recordHistory(string $domain, string $action, array $details = []): bool
    {
        try {
            $historyFile = self::getDomainsDbDir() . '/history.json';

            // Load existing history
            $history = [];
            if (file_exists($historyFile)) {
                $content = file_get_contents($historyFile);
                $data = json_decode($content, true);
                $history = $data['entries'] ?? [];
            }

            // Add new entry
            $entry = [
                'timestamp' => date('Y-m-d H:i:s'),
                'domain' => $domain,
                'action' => $action,
                'details' => $details,
                'user' => get_current_user()
            ];

            array_unshift($history, $entry);

            // Keep only last 1000 entries
            $history = array_slice($history, 0, 1000);

            // Save history
            $data = [
                'version' => '1.0',
                'updated_at' => date('Y-m-d H:i:s'),
                'entries' => $history
            ];

            $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
            if (file_put_contents($historyFile, $json) !== false) {
                return true;
            }

            return false;

        } catch (\Exception $e) {
            Log::error('Failed to record history', [
                'domain' => $domain,
                'action' => $action,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Get domain history
     *
     * @param string|null $domain Optional domain filter
     * @param int $limit Max entries to return
     * @return array History entries
     */
    public static function getHistory(?string $domain = null, int $limit = 100): array
    {
        try {
            $historyFile = self::getDomainsDbDir() . '/history.json';

            if (!file_exists($historyFile)) {
                return [];
            }

            $content = file_get_contents($historyFile);
            $data = json_decode($content, true);
            $history = $data['entries'] ?? [];

            // Filter by domain if specified
            if ($domain !== null) {
                $history = array_filter($history, function($entry) use ($domain) {
                    return $entry['domain'] === $domain;
                });
            }

            // Apply limit
            return array_slice($history, 0, $limit);

        } catch (\Exception $e) {
            Log::error('Failed to get history', ['error' => $e->getMessage()]);
            return [];
        }
    }

    // ========================================
    // EXTENDED FEATURES - Backup & Restore
    // ========================================

    /**
     * Backup domains configuration
     *
     * @param string|null $backupName Optional backup name
     * @return array Backup result with file path
     */
    public static function backupDomains(?string $backupName = null): array
    {
        try {
            $backupDir = PathMapper::mapWebPath('backup') . '/servermanager/domains';

            if (!is_dir($backupDir)) {
                if (!mkdir($backupDir, 0755, true)) {
                    return [
                        'success' => false,
                        'error' => 'Failed to create backup directory'
                    ];
                }
            }

            $backupName = $backupName ?? 'domains_backup_' . date('Y-m-d_H-i-s');
            $backupFile = $backupDir . '/' . $backupName . '.json';

            // Load current domains
            $domains = self::loadDomains();

            // Create backup data
            $backupData = [
                'version' => '1.0',
                'backup_date' => date('Y-m-d H:i:s'),
                'total_domains' => count($domains),
                'domains' => $domains
            ];

            $json = json_encode($backupData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
            if (file_put_contents($backupFile, $json) !== false) {
                Log::info('Domains backup created', ['file' => $backupFile, 'count' => count($domains)]);
                return [
                    'success' => true,
                    'backup_file' => $backupFile,
                    'total_domains' => count($domains),
                    'backup_name' => $backupName
                ];
            }

            return [
                'success' => false,
                'error' => 'Failed to write backup file'
            ];

        } catch (\Exception $e) {
            Log::error('Failed to backup domains', ['error' => $e->getMessage()]);
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Extract base domain from subdomain
     * Examples: api.12gm.com -> 12gm.com, sh.api.12gm.com -> 12gm.com
     *
     * @param string $domain Full domain name
     * @return string Base domain
     */
    private static function extractBaseDomain(string $domain): string
    {
        $parts = explode('.', $domain);
        $count = count($parts);

        if ($count <= 2) {
            return $domain;
        }

        return implode('.', array_slice($parts, -2));
    }

    /**
     * Restore domains from backup
     *
     * @param string $backupFile Backup file path
     * @param bool $merge Merge with existing domains instead of replacing
     * @return array Restore result
     */
    public static function restoreDomains(string $backupFile, bool $merge = false): array
    {
        try {
            if (!file_exists($backupFile)) {
                return [
                    'success' => false,
                    'error' => 'Backup file not found: ' . $backupFile
                ];
            }

            $content = file_get_contents($backupFile);
            $backupData = json_decode($content, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                return [
                    'success' => false,
                    'error' => 'Invalid JSON in backup file: ' . json_last_error_msg()
                ];
            }

            $backupDomains = $backupData['domains'] ?? [];

            if ($merge) {
                // Merge with existing domains
                $currentDomains = self::loadDomains();
                $domains = array_merge($currentDomains, $backupDomains);
                $action = 'merged';
            } else {
                // Replace all domains
                $domains = $backupDomains;
                $action = 'replaced';
            }

            if (self::saveDomains($domains)) {
                Log::info('Domains restored from backup', [
                    'file' => $backupFile,
                    'action' => $action,
                    'count' => count($backupDomains)
                ]);
                return [
                    'success' => true,
                    'action' => $action,
                    'restored_domains' => count($backupDomains),
                    'total_domains' => count($domains)
                ];
            }

            return [
                'success' => false,
                'error' => 'Failed to save restored domains'
            ];

        } catch (\Exception $e) {
            Log::error('Failed to restore domains', ['error' => $e->getMessage()]);
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * List available backups
     *
     * @return array List of backup files
     */
    public static function listBackups(): array
    {
        try {
            $backupDir = PathMapper::mapWebPath('backup') . '/servermanager/domains';

            if (!is_dir($backupDir)) {
                return [];
            }

            $files = glob($backupDir . '/*.json');
            $backups = [];

            foreach ($files as $file) {
                $content = file_get_contents($file);
                $data = json_decode($content, true);

                $backups[] = [
                    'file' => $file,
                    'name' => basename($file, '.json'),
                    'date' => $data['backup_date'] ?? null,
                    'total_domains' => $data['total_domains'] ?? 0,
                    'size' => filesize($file)
                ];
            }

            // Sort by date descending
            usort($backups, function($a, $b) {
                return strcmp($b['date'] ?? '', $a['date'] ?? '');
            });

            return $backups;

        } catch (\Exception $e) {
            Log::error('Failed to list backups', ['error' => $e->getMessage()]);
            return [];
        }
    }

    // ========================================
    // EXTENDED FEATURES - Import & Export
    // ========================================

    /**
     * Export domains to various formats
     *
     * @param string $format Format: json, csv, nginx
     * @param array $options Export options
     * @return array Export result with file path
     */
    public static function exportDomains(string $format = 'json', array $options = []): array
    {
        try {
            $exportDir = PathMapper::mapWebPath('backup') . '/servermanager/exports';

            if (!is_dir($exportDir)) {
                if (!mkdir($exportDir, 0755, true)) {
                    return [
                        'success' => false,
                        'error' => 'Failed to create export directory'
                    ];
                }
            }

            $timestamp = date('Y-m-d_H-i-s');
            $domains = self::loadDomains();

            switch ($format) {
                case 'json':
                    $exportFile = $exportDir . '/domains_export_' . $timestamp . '.json';
                    $content = json_encode($domains, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
                    break;

                case 'csv':
                    $exportFile = $exportDir . '/domains_export_' . $timestamp . '.csv';
                    $content = self::domainsToCSV($domains);
                    break;

                case 'nginx':
                    $exportFile = $exportDir . '/domains_export_' . $timestamp . '.txt';
                    $content = self::domainsToNginxList($domains);
                    break;

                default:
                    return [
                        'success' => false,
                        'error' => 'Unsupported format: ' . $format
                    ];
            }

            if (file_put_contents($exportFile, $content) !== false) {
                return [
                    'success' => true,
                    'export_file' => $exportFile,
                    'format' => $format,
                    'total_domains' => count($domains)
                ];
            }

            return [
                'success' => false,
                'error' => 'Failed to write export file'
            ];

        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Convert domains to CSV format
     */
    private static function domainsToCSV(array $domains): string
    {
        $csv = "Domain,Type,Status,SSL,PHP Version,WWW Dir,Created At\n";

        foreach ($domains as $domain => $config) {
            $csv .= sprintf(
                "%s,%s,%s,%s,%s,%s,%s\n",
                $domain,
                $config['type'],
                $config['status'],
                ($config['ssl_enabled'] ?? false) ? 'Yes' : 'No',
                $config['php_version'],
                $config['www_dir'],
                $config['created_at'] ?? ''
            );
        }

        return $csv;
    }

    /**
     * Convert domains to nginx configuration list
     */
    private static function domainsToNginxList(array $domains): string
    {
        $list = "# Nginx Domains List\n";
        $list .= "# Generated at " . date('Y-m-d H:i:s') . "\n\n";

        foreach ($domains as $domain => $config) {
            $list .= "# $domain\n";
            $list .= "# Type: " . $config['type'] . "\n";
            $list .= "# Status: " . $config['status'] . "\n";
            $list .= "# SSL: " . (($config['ssl_enabled'] ?? false) ? 'Enabled' : 'Disabled') . "\n";
            $list .= "# Config: " . ($config['nginx_config_file'] ?? 'N/A') . "\n";
            $list .= "\n";
        }

        return $list;
    }

    /**
     * Import domains from file
     *
     * @param string $importFile Import file path
     * @param string $format Format: json, csv
     * @param bool $merge Merge with existing domains
     * @return array Import result
     */
    public static function importDomains(string $importFile, string $format = 'json', bool $merge = true): array
    {
        try {
            if (!file_exists($importFile)) {
                return [
                    'success' => false,
                    'error' => 'Import file not found'
                ];
            }

            $content = file_get_contents($importFile);

            switch ($format) {
                case 'json':
                    $importedDomains = json_decode($content, true);
                    if (json_last_error() !== JSON_ERROR_NONE) {
                        return [
                            'success' => false,
                            'error' => 'Invalid JSON: ' . json_last_error_msg()
                        ];
                    }
                    break;

                case 'csv':
                    $importedDomains = self::parseCSV($content);
                    break;

                default:
                    return [
                        'success' => false,
                        'error' => 'Unsupported format: ' . $format
                    ];
            }

            if ($merge) {
                $currentDomains = self::loadDomains();
                $domains = array_merge($currentDomains, $importedDomains);
            } else {
                $domains = $importedDomains;
            }

            if (self::saveDomains($domains)) {
                return [
                    'success' => true,
                    'imported_domains' => count($importedDomains),
                    'total_domains' => count($domains)
                ];
            }

            return [
                'success' => false,
                'error' => 'Failed to save imported domains'
            ];

        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Parse CSV content to domains array
     */
    private static function parseCSV(string $content): array
    {
        $domains = [];
        $lines = explode("\n", $content);

        // Skip header
        array_shift($lines);

        foreach ($lines as $line) {
            if (empty(trim($line))) {
                continue;
            }

            $parts = str_getcsv($line);
            if (count($parts) < 7) {
                continue;
            }

            $domain = $parts[0];
            $domains[$domain] = [
                'domain' => $domain,
                'type' => $parts[1],
                'status' => $parts[2],
                'ssl_enabled' => $parts[3] === 'Yes',
                'php_version' => $parts[4],
                'www_dir' => $parts[5],
                'created_at' => $parts[6],
                'updated_at' => date('Y-m-d H:i:s'),
                'nginx_enabled' => false
            ];
        }

        return $domains;
    }

    // ========================================
    // EXTENDED FEATURES - Configuration Validation
    // ========================================

    /**
     * Validate all domain configurations
     *
     * @return array Validation results
     */
    public static function validateAllConfigurations(): array
    {
        $domains = self::loadDomains();
        $results = [
            'total' => count($domains),
            'valid' => 0,
            'invalid' => 0,
            'warnings' => 0,
            'issues' => []
        ];

        foreach ($domains as $domain => $config) {
            $validation = self::validateDomainConfiguration($domain, $config);

            if ($validation['valid']) {
                $results['valid']++;
            } else {
                $results['invalid']++;
            }

            if (!empty($validation['warnings'])) {
                $results['warnings'] += count($validation['warnings']);
            }

            if (!$validation['valid'] || !empty($validation['warnings'])) {
                $results['issues'][$domain] = $validation;
            }
        }

        return $results;
    }

    /**
     * Validate single domain configuration
     *
     * @param string $domain Domain name
     * @param array $config Domain configuration
     * @return array Validation result
     */
    public static function validateDomainConfiguration(string $domain, array $config): array
    {
        $errors = [];
        $warnings = [];

        // Check www_dir exists
        if (!is_dir($config['www_dir'])) {
            $errors[] = 'Directory does not exist: ' . $config['www_dir'];
        } else {
            // Check directory is writable
            if (!is_writable($config['www_dir'])) {
                $warnings[] = 'Directory is not writable: ' . $config['www_dir'];
            }
        }

        // Check nginx config file
        $configFile = ServerManagerV1PathConfig::getNginxSiteConfig($domain, $config['ssl_enabled'] ?? false);
        if (!file_exists($configFile)) {
            $errors[] = 'Nginx config file not found: ' . $configFile;
        }

        // Check nginx enabled link
        if ($config['nginx_enabled'] ?? false) {
            $enabledFile = ServerManagerV1PathConfig::getNginxEnabledSite($domain);
            if (!file_exists($enabledFile) && !is_link($enabledFile)) {
                $warnings[] = 'Nginx enabled link not found: ' . $enabledFile;
            }
        }

        // Check SSL certificate
        if ($config['ssl_enabled'] ?? false) {
            $certDir = ServerManagerV1PathConfig::getSslCertDir($domain);
            $fullchainPath = "$certDir/fullchain.pem";
            $privkeyPath = "$certDir/privkey.pem";

            if (!file_exists($fullchainPath)) {
                $errors[] = 'SSL certificate not found: ' . $fullchainPath;
            }
            if (!file_exists($privkeyPath)) {
                $errors[] = 'SSL private key not found: ' . $privkeyPath;
            }
        }

        // Check PHP-FPM socket for PHP sites
        if (in_array($config['type'], ['laravel', 'poly', 'php'])) {
            $phpVersion = $config['php_version'] ?? '8.2';
            $socketPath = "/var/run/php/php$phpVersion-fpm.sock";
            if (!file_exists($socketPath)) {
                $warnings[] = "PHP-FPM socket not found: $socketPath";
            }
        }

        return [
            'domain' => $domain,
            'valid' => empty($errors),
            'errors' => $errors,
            'warnings' => $warnings
        ];
    }

    // ========================================
    // EXTENDED FEATURES - Domain Alias & Redirect
    // ========================================

    /**
     * Add domain alias (www redirect)
     *
     * @param string $sourceDomain Source domain (e.g., www.example.com)
     * @param string $targetDomain Target domain (e.g., example.com)
     * @param int $redirectCode Redirect HTTP code (301 or 302)
     * @return bool Success status
     */
    public static function addDomainAlias(string $sourceDomain, string $targetDomain, int $redirectCode = 301): bool
    {
        try {
            $domains = self::loadDomains();

            // Check if target domain exists
            if (!isset($domains[$targetDomain])) {
                Log::error('Target domain not found', ['target' => $targetDomain]);
                return false;
            }

            // Create alias configuration
            $aliasConfig = [
                'domain' => $sourceDomain,
                'type' => 'alias',
                'alias_target' => $targetDomain,
                'redirect_code' => $redirectCode,
                'www_dir' => $domains[$targetDomain]['www_dir'],
                'status' => 'active',
                'nginx_enabled' => true,
                'ssl_enabled' => $domains[$targetDomain]['ssl_enabled'] ?? false,
                'ssl_certificate_id' => $domains[$targetDomain]['ssl_certificate_id'] ?? null,
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s')
            ];

            // Generate nginx redirect configuration
            if (!self::generateRedirectConfig($sourceDomain, $targetDomain, $redirectCode, $aliasConfig)) {
                Log::error('Failed to generate redirect config');
                return false;
            }

            $domains[$sourceDomain] = $aliasConfig;

            if (self::saveDomains($domains)) {
                Log::info('Domain alias added', [
                    'source' => $sourceDomain,
                    'target' => $targetDomain,
                    'code' => $redirectCode
                ]);
                return true;
            }

            return false;

        } catch (\Exception $e) {
            Log::error('Failed to add domain alias', [
                'source' => $sourceDomain,
                'target' => $targetDomain,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Generate nginx redirect configuration
     */
    private static function generateRedirectConfig(string $sourceDomain, string $targetDomain, int $redirectCode, array $config): bool
    {
        // Use PathMapper methods instead of deprecated constants (no hardcoded paths)
        $nginxConfigDir = ServerManagerV1PathConfig::getNginxSitesAvailable();
        $nginxEnabledDir = ServerManagerV1PathConfig::getNginxSitesEnabled();

        $configFile = "$nginxConfigDir/$sourceDomain";
        $enabledFile = "$nginxEnabledDir/$sourceDomain";

        $sslEnabled = $config['ssl_enabled'] ?? false;

        // HTTP configuration
        $httpConfig = "# Redirect configuration for $sourceDomain -> $targetDomain\n";
        $httpConfig .= "# Generated by ServerManagerV1 at " . date('Y-m-d H:i:s') . "\n\n";
        $httpConfig .= "server {\n";
        $httpConfig .= "    listen 80;\n";
        $httpConfig .= "    listen [::]:80;\n";
        $httpConfig .= "    server_name $sourceDomain;\n\n";

        if ($sslEnabled) {
            // Redirect HTTP to HTTPS
            $httpConfig .= "    return 301 https://$targetDomain\$request_uri;\n";
        } else {
            // Direct redirect
            $httpConfig .= "    return $redirectCode http://$targetDomain\$request_uri;\n";
        }

        $httpConfig .= "}\n";

        // HTTPS configuration
        if ($sslEnabled) {
            $baseDomain = self::extractBaseDomain($targetDomain);
            $certDir = ServerManagerV1PathConfig::getSslCertDir($baseDomain);
            $httpConfig .= "\nserver {\n";
            $httpConfig .= "    listen 443 ssl http2;\n";
            $httpConfig .= "    listen [::]:443 ssl http2;\n";
            $httpConfig .= "    server_name $sourceDomain;\n\n";
            $httpConfig .= "    ssl_certificate $certDir/fullchain.pem;\n";
            $httpConfig .= "    ssl_certificate_key $certDir/privkey.pem;\n\n";
            $httpConfig .= "    return $redirectCode https://$targetDomain\$request_uri;\n";
            $httpConfig .= "}\n";
        }

        // Write config file
        if (file_put_contents($configFile, $httpConfig) === false) {
            return false;
        }

        // Create symlink
        if (file_exists($enabledFile) || is_link($enabledFile)) {
            unlink($enabledFile);
        }

        return symlink($configFile, $enabledFile);
    }

    // ========================================
    // EXTENDED FEATURES - Site Templates
    // ========================================

    /**
     * Get available site templates
     *
     * @return array List of templates
     */
    public static function getTemplates(): array
    {
        return [
            'laravel_api' => [
                'name' => 'Laravel API',
                'description' => 'API-only Laravel application with CORS support',
                'type' => 'laravel',
                'features' => ['api', 'cors', 'rate-limiting'],
                'php_version' => '8.4',
                'ssl_required' => true
            ],
            'laravel_full' => [
                'name' => 'Laravel Full Stack',
                'description' => 'Full Laravel application with frontend',
                'type' => 'laravel',
                'features' => ['web', 'api', 'auth'],
                'php_version' => '8.4',
                'ssl_required' => false
            ],
            'static_spa' => [
                'name' => 'Static SPA',
                'description' => 'Static single-page application (Vue/React)',
                'type' => 'html',
                'features' => ['spa', 'gzip', 'cache'],
                'php_version' => null,
                'ssl_required' => false
            ],
            'wordpress' => [
                'name' => 'WordPress',
                'description' => 'WordPress CMS site',
                'type' => 'php',
                'features' => ['php', 'mysql', 'uploads'],
                'php_version' => '8.2',
                'ssl_required' => false
            ]
        ];
    }

    /**
     * Apply template to domain
     *
     * @param string $domain Domain name
     * @param string $templateId Template identifier
     * @param array $options Additional options
     * @return bool Success status
     */
    public static function applyTemplate(string $domain, string $templateId, array $options = []): bool
    {
        $templates = self::getTemplates();

        if (!isset($templates[$templateId])) {
            Log::error('Template not found', ['template' => $templateId]);
            return false;
        }

        $template = $templates[$templateId];

        // Merge template defaults with options
        $config = array_merge([
            'type' => $template['type'],
            'php_version' => $template['php_version'] ?? '8.4',
            'ssl_enabled' => $template['ssl_required'],
            'template_id' => $templateId,
            'template_applied_at' => date('Y-m-d H:i:s')
        ], $options);

        return self::addDomain($domain, $config);
    }

    // ========================================
    // Swoole/Octane Mode Management
    // ========================================

    /**
     * Switch domain PHP mode between FPM and Swoole
     *
     * @param string $domain Domain name
     * @param string $newMode New mode: fpm, swoole
     * @param array $options Optional configuration: swoole_port, swoole_workers
     * @return bool Success status
     */
    public static function switchPhpMode(string $domain, string $newMode, array $options = []): bool
    {
        Log::info('PHP mode switching disabled - Swoole mode is fixed for all sites', [
            'domain' => $domain,
            'requested_mode' => $newMode,
            'current_mode' => 'swoole'
        ]);

        // Always return true since all sites are already in swoole mode
        return true;
    }

    /**
     * Get next available Swoole port
     * SYNC: ServerManagerV1OctaneServiceManager::getNextAvailablePort()
     *
     * @return int Available port number
     */
    private static function getNextAvailableSwoolePort(): int
    {
        // Use OctaneServiceManager's method for consistency
        return ServerManagerV1OctaneServiceManager::getNextAvailablePort();
    }

    /**
     * Get Swoole service information by path (PATH-BASED)
     * Returns service info for a directory path
     *
     * @param string $wwwDir Directory path
     * @return array|null Service info or null if not using Swoole
     */
    public static function getSwooleServiceInfoByPath(string $wwwDir): ?array
    {
        $domains = self::loadDomains();

        // Find any domain using this directory with Swoole
        $swooleConfig = null;
        $domainsUsingService = [];

        foreach ($domains as $domain => $config) {
            if (($config['www_dir'] ?? '') === $wwwDir) {
                $phpMode = $config['php_mode'] ?? 'fpm';

                $phpMode = ServerManagerV1PathConfig::normalizePhpMode($phpMode);
                if (ServerManagerV1PathConfig::isSwooleMode($phpMode)) {
                    if ($swooleConfig === null) {
                        $swooleConfig = $config;
                    }
                    $domainsUsingService[] = $domain;
                }
            }
        }

        if ($swooleConfig === null) {
            return null;
        }

        // Auto-calculate port and workers based on app index and CPU cores
        $port = ServerManagerV1OctaneServiceManager::getPortFromPathHash($wwwDir);
        $workers = ServerManagerV1OctaneServiceManager::getDefaultWorkers();
        $pathHash = ServerManagerV1OctaneServiceManager::getPathHash($wwwDir);
        $serviceName = ServerManagerV1OctaneServiceManager::getOctaneServiceNameFromPath($wwwDir, $port);

        return [
            'service_name' => $serviceName,
            'www_dir' => $wwwDir,
            'path_hash' => $pathHash,
            'port' => $port,
            'workers' => $workers,
            'mode' => ServerManagerV1PathConfig::normalizePhpMode($swooleConfig['php_mode'] ?? 'swoole'),
            'domains' => $domainsUsingService,
            'domain_count' => count($domainsUsingService)
        ];
    }

    /**
     * Get Swoole service information for domain
     *
     * @param string $domain Domain name
     * @return array|null Service info or null if not using Swoole
     */
    public static function getSwooleServiceInfo(string $domain): ?array
    {
        $config = self::getDomain($domain);

        if (!$config) {
            return null;
        }

        $phpMode = ServerManagerV1PathConfig::normalizePhpMode($config['php_mode'] ?? 'fpm');

        if (!ServerManagerV1PathConfig::isSwooleMode($phpMode)) {
            return null;
        }

        // Get path-based service info
        $pathInfo = self::getSwooleServiceInfoByPath($config['www_dir']);

        if (!$pathInfo) {
            return null;
        }

        // Return info with domain-specific context
        // Use auto-calculated port and workers from pathInfo (not cached values from config)
        return [
            'service_name' => $pathInfo['service_name'],
            'domain' => $domain,
            'www_dir' => $config['www_dir'],
            'path_hash' => $pathInfo['path_hash'],
            'port' => $pathInfo['port'],
            'workers' => $pathInfo['workers'],
            'mode' => $phpMode,
            'all_domains' => $pathInfo['domains'],
            'is_primary' => ($pathInfo['domains'][0] ?? null) === $domain,
            'primary_domain' => $pathInfo['domains'][0] ?? $domain
        ];
    }

    /**
     * Get primary domain for a directory (first domain added with this directory)
     *
     * @param string $wwwDir Directory path
     * @return string Primary domain name
     */
    private static function getPrimaryDomainForDirectory(string $wwwDir): string
    {
        $domains = self::loadDomains();

        foreach ($domains as $domain => $config) {
            if (($config['www_dir'] ?? '') === $wwwDir) {
                $phpMode = ServerManagerV1PathConfig::normalizePhpMode($config['php_mode'] ?? 'fpm');
                if (ServerManagerV1PathConfig::isSwooleMode($phpMode)) {
                    return $domain; // Return first matching domain
                }
            }
        }

        return 'unknown';
    }

    /**
     * Get all domains grouped by PHP mode
     *
     * @return array Domains grouped by mode
     */
    public static function getDomainsGroupedByPhpMode(): array
    {
        $domains = self::loadDomains();
        $grouped = [
            'fpm' => [],
            'swoole' => [],
            'octane' => [],
            'none' => []
        ];

        foreach ($domains as $domain => $config) {
            $mode = $config['php_mode'] ?? 'none';

            if (!in_array($config['type'], ['laravel', 'poly', 'php'])) {
                $mode = 'none';
            }

            if (!isset($grouped[$mode])) {
                $grouped[$mode] = [];
            }

            $grouped[$mode][] = [
                'domain' => $domain,
                'type' => $config['type'],
                'status' => $config['status'],
                'swoole_port' => $config['swoole_port'] ?? null,
                'swoole_workers' => $config['swoole_workers'] ?? null,
                'www_dir' => $config['www_dir'] ?? null
            ];
        }

        return $grouped;
    }

    /**
     * Get all unique Swoole services (grouped by directory)
     * One directory = One Swoole service shared by multiple domains
     *
     * @return array Unique Swoole services info
     */
    public static function getUniqueSwooleServices(): array
    {
        $domains = self::loadDomains();
        $services = [];

        foreach ($domains as $domain => $config) {
            $phpMode = $config['php_mode'] ?? 'fpm';

            $phpMode = ServerManagerV1PathConfig::normalizePhpMode($phpMode);
            if (!ServerManagerV1PathConfig::isSwooleMode($phpMode)) {
                continue;
            }

            $wwwDir = $config['www_dir'] ?? '';
            $port = $config['swoole_port'] ?? null;

            if (!$wwwDir || !$port) {
                continue;
            }

            // Use www_dir as key to ensure uniqueness
            if (!isset($services[$wwwDir])) {
                $services[$wwwDir] = [
                    'www_dir' => $wwwDir,
                    'port' => $port,
                    'workers' => $config['swoole_workers'] ?? 4,
                    'primary_domain' => $domain,
                    'domains' => []
                ];
            }

            $services[$wwwDir]['domains'][] = $domain;
        }

        return array_values($services);
    }
}
