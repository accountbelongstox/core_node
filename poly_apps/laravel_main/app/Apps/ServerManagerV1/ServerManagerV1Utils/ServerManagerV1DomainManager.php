<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use Illuminate\Support\Facades\Log;
use App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig;

/**
 * Domain Management Utility for ServerManagerV1
 * 
 * Manages domain configurations in JSON files stored in /www/wwwroot/laravel_db
 * instead of using database storage.
 */
class ServerManagerV1DomainManager
{
    private const DOMAINS_DB_DIR = '/www/wwwroot/laravel_db/servermanager/domains';
    private const DOMAINS_FILE = 'domains.json';
    private const DEPLOYMENTS_FILE = 'deployments.json';
    
    /**
     * Get domains database file path
     */
    private static function getDomainsFilePath(): string
    {
        return self::DOMAINS_DB_DIR . '/' . self::DOMAINS_FILE;
    }
    
    /**
     * Get deployments database file path
     */
    private static function getDeploymentsFilePath(): string
    {
        return self::DOMAINS_DB_DIR . '/' . self::DEPLOYMENTS_FILE;
    }
    
    /**
     * Ensure database directory exists
     */
    private static function ensureDbDirectory(): bool
    {
        if (!is_dir(self::DOMAINS_DB_DIR)) {
            if (!mkdir(self::DOMAINS_DB_DIR, 0755, true)) {
                Log::error('Failed to create domains database directory: ' . self::DOMAINS_DB_DIR);
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
    public static function addDomain(string $domain, array $config): bool
    {
        $domains = self::loadDomains();

        $wwwDir = $config['www_dir'] ?? "/www/wwwroot/$domain";

        $domainConfig = [
            'domain' => $domain,
            'type' => $config['type'] ?? 'laravel',
            'www_dir' => $wwwDir,
            'php_version' => $config['php_version'] ?? '8.2',
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
        }

        // Generate nginx configuration file
        if ($config['nginx_enabled'] ?? false) {
            self::generateNginxConfig($domain, $domainConfig);
        }

        // Add or update domain
        $domains[$domain] = $domainConfig;

        if (self::saveDomains($domains)) {
            Log::info('Domain added/updated successfully', ['domain' => $domain]);
            return true;
        }

        return false;
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
        
        unset($domains[$domain]);
        
        if (self::saveDomains($domains)) {
            Log::info('Domain removed successfully', ['domain' => $domain]);
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
        $nginxConfigDir = ServerManagerV1PathConfig::NGINX_SITES_AVAILABLE;
        $nginxEnabledDir = ServerManagerV1PathConfig::NGINX_SITES_ENABLED;

        // Create directories if they don't exist
        if (!is_dir($nginxConfigDir)) {
            mkdir($nginxConfigDir, 0755, true);
        }
        if (!is_dir($nginxEnabledDir)) {
            mkdir($nginxEnabledDir, 0755, true);
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
            // Get certificate path from certificate manager
            $certificate = \App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1CertificateManager::findCertificateForDomain($domain);
            if ($certificate && isset($certificate['certificate_path'])) {
                $certDir = rtrim($certificate['certificate_path'], '/');
            } else {
                // Fallback to domain-based path using PathConfig
                $certDir = ServerManagerV1PathConfig::getSslCertDir($domain);
            }
        }

        // Generate PHP configuration for Laravel/PHP sites
        $phpConfig = '';
        if (in_array($config['type'], ['laravel', 'poly', 'php'])) {
            $phpVersion = $config['php_version'] ?? '8.2';
            $phpConfig = "
    # PHP Configuration
    index index.php index.html index.htm;

    location ~ \\.php\$ {
        try_files \$uri =404;
        fastcgi_pass unix:/var/run/php/php$phpVersion-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME \$realpath_root\$fastcgi_script_name;
        include fastcgi_params;

        # Security headers
        fastcgi_param HTTP_PROXY \"\";
        fastcgi_read_timeout 300;
    }";

            // Laravel specific configuration
            if (in_array($config['type'], ['laravel', 'poly'])) {
                $phpConfig .= "

    # Laravel specific configuration
    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    # Deny access to sensitive files
    location ~ /\\. {
        deny all;
    }

    location ~ /(storage|bootstrap/cache) {
        deny all;
    }";
            }
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
                return false;
            }

            // Write SSL configuration file
            $sslResult = file_put_contents($sslConfigFile, $sslConfig);
            if ($sslResult === false) {
                return false;
            }

            // Use SSL configuration as the active one
            $activeConfigFile = $sslConfigFile;
        } else {
            // Write HTTP configuration file
            $httpResult = file_put_contents($configFile, $httpConfig);
            if ($httpResult === false) {
                return false;
            }

            // Use HTTP configuration as the active one
            $activeConfigFile = $configFile;
        }

        // Create symbolic link to enable the appropriate configuration
        return symlink($activeConfigFile, $enabledFile);
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

            // Step 2: Clean up all existing nginx configurations
            $nginxConfigDir = ServerManagerV1PathConfig::NGINX_SITES_AVAILABLE;
            $nginxEnabledDir = ServerManagerV1PathConfig::NGINX_SITES_ENABLED;

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
}
