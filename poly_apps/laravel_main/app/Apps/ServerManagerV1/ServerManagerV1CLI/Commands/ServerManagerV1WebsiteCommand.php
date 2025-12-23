<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands;

use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1DomainManager;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1CertificateManager;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1OctaneServiceManager;
use App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig;
use Illuminate\Support\Facades\Log;

class ServerManagerV1WebsiteCommand extends ServerManagerV1BaseCommand
{
    // TODO: Web API version available at ServerManagerV1NginxManagerCtl
    // API endpoints: GET /api/websites, POST /api/websites, etc.

    /**
     * The name and signature of the console command.
     */
    protected $signature = 'servermanager:website
                            {action : Action to perform (add|list|summary|status|remove|cleanup|refresh)}
                            {domain? : Domain name (required for add, status, remove, refresh)}
                            {--type= : Website type (default: laravel)}
                            {--ssl= : SSL mode (auto|true|false, default: auto)}
                            {--php-version= : PHP version (default: 8.2)}
                            {--php-mode= : PHP mode (fpm|swoole, default: fpm)}
                            {--all : Apply action to all websites (for refresh)}';

    /**
     * The console command description.
     */
    protected $description = 'Manage nginx websites with SSL certificate integration';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        // PRE-REQUISITE: Fix PHP configuration before any operations
        // This ensures open_basedir restrictions are correct (matches 32_configure_php84.sh)
        $this->initializeCommand();

        $action = $this->argument('action');
        $domain = $this->argument('domain');

        return match($action) {
            'add' => $this->addWebsite($domain),
            'list' => $this->listWebsites(),
            'summary' => $this->showSummary(),
            'status' => $this->showStatus($domain),
            'remove' => $this->removeWebsite($domain),
            'cleanup' => $this->cleanupOrphanedServices(),
            'refresh' => $this->refreshWebsites($domain),
            default => $this->showHelp()
        };
    }

    /**
     * Add website
     */
    private function addWebsite(?string $domain): int
    {
        if (!$domain) {
            $this->error("Domain is required for add action");
            return 1;
        }

        if (!$this->validateDomain($domain)) {
            return 1;
        }

        $type = $this->option('type') ?: 'laravel';
        $sslMode = $this->option('ssl') ?: 'auto';
        $phpVersion = $this->option('php-version') ?: '8.5';
        // Normalize php-mode: convert legacy 'octane' to 'swoole'
        $phpMode = ServerManagerV1PathConfig::normalizePhpMode($this->option('php-mode') ?: 'fpm');

        // Check for domain conflict and show brief update message
        $conflict = ServerManagerV1DomainManager::checkDomainConflict($domain);
        if ($conflict) {
            $domainDir = $this->getDomainDirectory($domain, $type);
            $willMigrate = $domainDir !== $conflict['www_dir'];

            if ($willMigrate) {
                $this->info("Updating domain (migrating to new directory)");
            } else {
                $this->info("Updating domain configuration");
            }
        }

        $this->info("Adding website: $domain (type=$type, php-mode=$phpMode, ssl=$sslMode)");

        // Process domain to handle www prefix with improved logic
        $baseDomain = $domain;
        $wwwDomain = null;
        $domainParts = explode('.', $domain);

        if (strpos($domain, 'www.') === 0 && count($domainParts) === 3) {
            // www.example.com -> example.com
            $baseDomain = substr($domain, 4);
            $wwwDomain = $domain;
        } elseif (strpos($domain, 'www.') !== 0 && count($domainParts) === 2) {
            // example.com -> www.example.com
            $wwwDomain = "www.$domain";
        }
        // For subdomains like api.example.com, don't add www prefix

        // Check for existing certificate
        $certificate = null;
        $sslEnabled = false;

        if ($sslMode === 'auto' || $sslMode === 'true') {
            $certificate = ServerManagerV1CertificateManager::findCertificateForDomain($baseDomain);
            if ($certificate) {
                $sslEnabled = true;
            } else {
                if ($sslMode === 'true') {
                    $this->error("SSL required but no certificate found");
                    return 1;
                }
            }
        }

        // Determine directory based on domain and type
        $domainDir = $this->getDomainDirectory($domain, $type);
        $documentRoot = $this->getDocumentRoot($domainDir, $type);

        // Create directories based on type
        if ($type === 'poly') {
            // For poly type, just verify Laravel directory exists
            if (!is_dir($domainDir)) {
                $this->error("Laravel directory not found: $domainDir");
                return 1;
            }
            if (!is_dir($documentRoot)) {
                $this->error("Laravel public directory not found: $documentRoot");
                return 1;
            }
        } else {
            // For html and laravel types, create directories in mapped wwwroot
            if (!is_dir($domainDir)) {
                if (!mkdir($domainDir, 0755, true)) {
                    $this->error("Failed to create domain directory");
                    return 1;
                }
            }

            // Create document root if different from domain dir
            if ($documentRoot !== $domainDir && !is_dir($documentRoot)) {
                if (!mkdir($documentRoot, 0755, true)) {
                    $this->error("Failed to create document root");
                    return 1;
                }
            }

            // Create index.html for html type
            if ($type === 'html') {
                $indexFile = $documentRoot . '/index.html';
                if (!file_exists($indexFile)) {
                    $this->createIndexFile($indexFile, $domain);
                }
            }
        }

        // Prepare all domains for this configuration
        $allDomains = [$baseDomain];
        if ($wwwDomain && $wwwDomain !== $baseDomain) {
            $allDomains[] = $wwwDomain;
        }

        // Add domain to database with all associated domains
        $domainResult = ServerManagerV1DomainManager::addDomain($baseDomain, [
            'type' => $type,
            'www_dir' => $domainDir,
            'nginx_enabled' => true,
            'ssl_enabled' => $sslEnabled,
            'ssl_certificate_id' => $certificate ? $certificate['id'] : null,
            'php_version' => $phpVersion,
            'php_mode' => $phpMode,  // Add php_mode parameter
            'status' => 'active',
            'all_domains' => $allDomains  // Pass all domains to generate single config
        ]);

        // No need to add www domain separately - it's handled in the same config
        $wwwResult = true;

        if ($domainResult && $wwwResult) {
            $this->info("Configured: $domain (ssl=" . ($sslEnabled ? 'yes' : 'no') . ")");

            // Show SSL certificate info if enabled
            if ($sslEnabled) {
                $certDir = ServerManagerV1PathConfig::getSslCertDir($baseDomain);
                $this->info("SSL certificate: " . $certificate['id'] . " at $certDir");
            }

            // Auto-start Swoole service if php-mode is swoole
            if (ServerManagerV1PathConfig::isSwooleMode($phpMode)) {
                $serviceInfo = ServerManagerV1DomainManager::getSwooleServiceInfo($baseDomain);

                if ($serviceInfo) {
                    $port = $serviceInfo['port'];
                    $workers = $serviceInfo['workers'];
                    $wwwDir = $serviceInfo['www_dir'];
                    $serviceName = $serviceInfo['service_name'];
                    $allDomains = $serviceInfo['all_domains'] ?? [$baseDomain];
                    $domainCount = count($allDomains);

                    // Check if systemd service exists and is active
                    exec("systemctl is-active $serviceName 2>/dev/null", $output, $return_code);
                    $serviceActive = ($return_code === 0);

                    // IDEMPOTENT DESIGN: Always regenerate service configuration
                    // This ensures configuration fixes (ProtectSystem, ReadWritePaths) are applied
                    // regardless of service state (running, stopped, or failed)
                    // Requirement: "反复运行时要修复问题，不能因为修复一个完成而跳过另一个"
                    $description = implode(', ', array_slice($allDomains, 0, 3)) . ($domainCount > 3 ? "... ($domainCount total)" : '');

                    // STEP 1: ALWAYS regenerate service file with latest configuration
                    // SYNC: This will use latest PHP code with ProtectSystem=full (Line 656)
                    ServerManagerV1OctaneServiceManager::createOctaneServiceFromPath(
                        $wwwDir,
                        $port,
                        $workers,
                        $wwwDir,
                        null,
                        null,
                        $description
                    );

                    // STEP 2: ALWAYS reload systemd daemon to pick up configuration changes
                    exec('systemctl daemon-reload 2>&1');

                    // STEP 3: Start or restart service based on current state
                    if ($serviceActive) {
                        // Service was running, restart to apply configuration changes
                        exec("systemctl restart $serviceName 2>&1", $output, $code);

                        if ($code === 0) {
                            $this->info("Swoole service restarted with updated config (service: $serviceName, port: $port, domains: $domainCount)");
                        } else {
                            $this->warn("Service config updated but restart failed - manual restart may be needed");
                        }
                    } else {
                        // Service was not running, start it
                        $started = ServerManagerV1OctaneServiceManager::startOctaneService($serviceName);

                        if ($started) {
                            $this->info("Swoole service started with updated config (service: $serviceName, port: $port, workers: $workers, domains: $domainCount)");
                        } else {
                            $this->warn("Failed to start Swoole service after config update");
                        }
                    }
                }
            }

            // Auto reload nginx
            exec('sudo systemctl reload nginx 2>&1', $output, $return_code);
            if ($return_code !== 0) {
                exec('sudo systemctl restart nginx 2>&1');
            }

            return 0;
        } else {
            $this->error("Failed to add website");
            return 1;
        }
    }

    /**
     * List all websites
     */
    private function listWebsites(): int
    {
        $domains = ServerManagerV1DomainManager::getAllDomains();

        if (empty($domains)) {
            $this->info("No websites found");
            return 0;
        }

        $this->info("All websites:");
        $this->line("");

        foreach ($domains as $domain => $config) {
            $sslStatus = $config['ssl_enabled'] ? 'SSL' : 'HTTP';
            $statusColor = match($config['status']) {
                'active' => 'info',
                'inactive' => 'comment',
                'error' => 'error',
                default => 'comment'
            };

            $this->line("Website: $domain");
            $this->line("  Type: " . $config['type']);
            $this->line("  Status: <$statusColor>" . $config['status'] . "</$statusColor>");
            $this->line("  Protocol: $sslStatus");
            $this->line("  PHP: " . $config['php_version']);
            $this->line("  Directory: " . $config['www_dir']);
            $this->line("  Created: " . $config['created_at']);
            
            if ($config['ssl_enabled'] && isset($config['ssl_certificate_id'])) {
                $this->line("  Certificate: " . $config['ssl_certificate_id']);
            }
            
            $this->line("");
        }

        return 0;
    }

    /**
     * Show websites summary
     */
    private function showSummary(): int
    {
        $summary = ServerManagerV1DomainManager::getDomainsSummary();

        $this->info("Websites Summary:");
        $this->line("  Total domains: " . $summary['total_domains']);
        $this->line("  Active domains: " . $summary['active_domains']);
        $this->line("  SSL enabled: " . $summary['ssl_enabled_domains']);
        $this->line("  Nginx enabled: " . $summary['nginx_enabled_domains']);
        $this->line("  Laravel sites: " . $summary['laravel_domains']);
        $this->line("  Static sites: " . $summary['static_domains']);
        $this->line("");

        if (!empty($summary['php_versions'])) {
            $this->info("PHP versions:");
            foreach ($summary['php_versions'] as $version => $count) {
                $this->line("  PHP $version: $count domains");
            }
            $this->line("");
        }

        if (!empty($summary['domains'])) {
            $this->info("Domain details:");
            foreach ($summary['domains'] as $domain) {
                $sslIcon = $domain['ssl_enabled'] ? '🔒' : '🔓';
                $nginxIcon = $domain['nginx_enabled'] ? '✅' : '❌';
                
                $this->line("  $sslIcon $nginxIcon " . $domain['domain'] . 
                           " (" . $domain['type'] . ", PHP " . $domain['php_version'] . ")");
            }
        }

        return 0;
    }

    /**
     * Show website status
     */
    private function showStatus(?string $domain): int
    {
        if (!$domain) {
            $this->error("Domain is required for status action");
            return 1;
        }

        $config = ServerManagerV1DomainManager::getDomain($domain);

        if (!$config) {
            $this->error("Website not found: $domain");
            return 1;
        }

        $this->info("Website Status: $domain");
        $this->line("");
        $this->line("General Information:");
        $this->line("  Domain: " . $config['domain']);
        $this->line("  Type: " . $config['type']);
        $this->line("  Status: " . $config['status']);
        $this->line("  Directory: " . $config['www_dir']);
        $this->line("  PHP version: " . $config['php_version']);
        $this->line("  Created: " . $config['created_at']);
        $this->line("  Updated: " . $config['updated_at']);
        $this->line("  Deployments: " . ($config['deployment_count'] ?? 0));
        $this->line("");

        $this->line("Nginx Configuration:");
        $this->line("  Enabled: " . ($config['nginx_enabled'] ? 'yes' : 'no'));
        $this->line("  Config file: " . ($config['nginx_config_file'] ?? 'N/A'));
        $this->line("");

        $this->line("SSL Configuration:");
        $this->line("  Enabled: " . ($config['ssl_enabled'] ? 'yes' : 'no'));
        $this->line("  Provider: " . ($config['ssl_provider'] ?? 'N/A'));
        
        if ($config['ssl_enabled'] && isset($config['ssl_certificate_id'])) {
            $this->line("  Certificate ID: " . $config['ssl_certificate_id']);
            
            // Get certificate details
            $baseDomain = $config['domain'];
            if (strpos($baseDomain, 'www.') === 0) {
                $baseDomain = substr($baseDomain, 4);
            }
            
            $certificate = ServerManagerV1CertificateManager::getCertificate($baseDomain);
            if ($certificate) {
                $this->line("  Certificate status: " . $certificate['status']);
                if (isset($certificate['expires_at'])) {
                    $this->line("  Expires: " . $certificate['expires_at']);
                }
            }
        }

        $this->line("");
        $this->line("Files:");
        $this->line("  Index file created: " . ($config['index_file_created'] ? 'yes' : 'no'));

        return 0;
    }

    /**
     * Remove website
     */
    private function removeWebsite(?string $domain): int
    {
        if (!$domain) {
            $this->error("Domain is required for remove action");
            return 1;
        }

        $config = ServerManagerV1DomainManager::getDomain($domain);

        if (!$config) {
            $this->error("Website not found: $domain");
            return 1;
        }

        $this->info("Removing website: $domain");

        // Get Swoole service info BEFORE removing domain
        $swooleInfo = null;
        $phpMode = ServerManagerV1PathConfig::normalizePhpMode($config['php_mode'] ?? 'fpm');
        if (ServerManagerV1PathConfig::isSwooleMode($phpMode)) {
            $swooleInfo = ServerManagerV1DomainManager::getSwooleServiceInfoByPath($config['www_dir']);
        }

        $result = ServerManagerV1DomainManager::removeDomain($domain);

        if ($result) {
            $this->info("Website removed successfully: $domain");

            // Update Swoole service description if domain was using Swoole
            if ($swooleInfo && isset($swooleInfo['service_name'])) {
                // Get updated list of domains after removal
                $updatedInfo = ServerManagerV1DomainManager::getSwooleServiceInfoByPath($config['www_dir']);

                if ($updatedInfo && count($updatedInfo['domains']) > 0) {
                    // Service still in use by other domains, update description
                    $allDomains = $updatedInfo['domains'];
                    $domainCount = count($allDomains);
                    $description = implode(', ', array_slice($allDomains, 0, 3)) . ($domainCount > 3 ? "... ($domainCount total)" : '');

                    ServerManagerV1OctaneServiceManager::createOctaneServiceFromPath(
                        $config['www_dir'],
                        $updatedInfo['port'],
                        $updatedInfo['workers'],
                        $config['www_dir'],
                        null,
                        null,
                        $description
                    );

                    exec('systemctl daemon-reload 2>&1');
                    $this->info("Updated Swoole service description (domains: $domainCount)");
                }
            }

            // Auto reload nginx
            exec('sudo systemctl reload nginx 2>&1', $output, $return_code);
            if ($return_code !== 0) {
                exec('sudo systemctl restart nginx 2>&1');
            }

            return 0;
        } else {
            $this->error("Failed to remove website: $domain");
            return 1;
        }
    }

    /**
     * Clean up orphaned Octane services
     */
    private function cleanupOrphanedServices(): int
    {
        $this->info("Cleaning up orphaned Octane services...");

        $results = ServerManagerV1OctaneServiceManager::cleanupOrphanedServices();

        $this->line("");
        $this->info("Cleanup Results:");
        $this->line("  Scanned: " . $results['scanned'] . " services");
        $this->line("  Kept: " . count($results['kept']) . " services");
        $this->line("  Removed: " . count($results['removed']) . " services");

        if (!empty($results['removed'])) {
            $this->line("");
            $this->info("Removed services:");
            foreach ($results['removed'] as $service) {
                $this->line("  - $service");
            }
        }

        if (!empty($results['errors'])) {
            $this->line("");
            $this->warn("Errors:");
            foreach ($results['errors'] as $error) {
                $this->line("  - $error");
            }
        }

        // Always clean systemd cache to remove "not-found" references
        $this->line("");
        $this->info("Cleaning systemd cache for not-found units...");

        $cacheResults = ServerManagerV1OctaneServiceManager::cleanupSystemdCache();

        if (!empty($cacheResults['cleaned'])) {
            $this->info("Cleaned " . count($cacheResults['cleaned']) . " not-found unit(s):");
            foreach ($cacheResults['cleaned'] as $unit) {
                $this->line("  - $unit");
            }
        } else {
            $this->info("No not-found units to clean");
        }

        if (!empty($cacheResults['errors'])) {
            $this->warn("Some errors occurred (non-critical):");
            foreach ($cacheResults['errors'] as $error) {
                $this->line("  - $error");
            }
        }

        return 0;
    }

    /**
     * Get domain directory based on domain and type
     * Uses PathMapper for environment-aware path resolution
     */
    private function getDomainDirectory(string $domain, string $type): string
    {
        // Use centralized type-to-path mapping
        return ServerManagerV1PathConfig::getPathForType($type, $domain);
    }

    /**
     * Get document root based on directory and type
     */
    private function getDocumentRoot(string $domainDir, string $type): string
    {
        switch ($type) {
            case 'laravel':
            case 'poly':
                return $domainDir . '/public';
            case 'html':
            default:
                return $domainDir;
        }
    }

    /**
     * Create index.html file for HTML websites
     */
    private function createIndexFile(string $indexFile, string $domain): void
    {
        $content = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to $domain</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        h1 {
            color: #333;
            margin-bottom: 20px;
        }
        .info {
            color: #666;
            margin: 20px 0;
        }
        .timestamp {
            color: #999;
            font-size: 0.9em;
            margin-top: 30px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎉 Welcome to $domain</h1>
        <p class="info">Your website is now successfully configured!</p>
        <p class="info">This is a default HTML page. You can replace this file with your own content.</p>
        <div class="timestamp">
            Created: " . date('Y-m-d H:i:s') . "
        </div>
    </div>
</body>
</html>
HTML;

        file_put_contents($indexFile, $content);
        $this->info("Created index.html file: $indexFile");
    }

    /**
     * Refresh nginx configuration for websites
     */
    private function refreshWebsites(?string $domain): int
    {
        if ($this->option('all')) {
            $this->info("Refreshing all website configurations...");

            $websites = ServerManagerV1DomainManager::getAllDomains();
            if (empty($websites)) {
                $this->info("No websites found");
                return 0;
            }

            $successCount = 0;
            $failCount = 0;

            foreach ($websites as $site) {
                $siteDomain = $site['domain'];
                $this->line("Refreshing: $siteDomain");

                $result = ServerManagerV1DomainManager::refreshDomainConfig($siteDomain);

                if ($result) {
                    $successCount++;
                    $this->info("  ✓ Refreshed: $siteDomain");
                } else {
                    $failCount++;
                    $this->error("  ✗ Failed: $siteDomain");
                }
            }

            $this->line("");
            $this->info("Refresh completed: $successCount succeeded, $failCount failed");

            return $failCount > 0 ? 1 : 0;
        }

        if (!$domain) {
            $this->error("Domain is required for refresh action (or use --all)");
            return 1;
        }

        $this->info("Refreshing nginx configuration for: $domain");

        $result = ServerManagerV1DomainManager::refreshDomainConfig($domain);

        if ($result) {
            $this->info("Configuration refreshed successfully: $domain");
            return 0;
        } else {
            $this->error("Failed to refresh configuration: $domain");
            return 1;
        }
    }

    /**
     * Show help information
     */
    private function showHelp(): int
    {
        $this->info("ServerManager Website Management");
        $this->line("");
        $this->info("Available actions:");
        $this->line("  add <domain>     - Add website with SSL auto-detection");
        $this->line("  list             - List all websites");
        $this->line("  summary          - Show websites summary");
        $this->line("  status <domain>  - Show website status");
        $this->line("  remove <domain>  - Remove website configuration");
        $this->line("  refresh <domain> - Refresh nginx configuration for domain");
        $this->line("  refresh --all    - Refresh all website configurations");
        $this->line("");
        $this->info("Options:");
        $this->line("  --type           - Website type: html|laravel|poly (default: laravel)");
        $wwwRoot = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getWwwRoot();
        $this->line("                     html: Static files in $wwwRoot/domain");
        $this->line("                     laravel: Laravel project in $wwwRoot/domain");
        $this->line("                     poly: Bind to current Laravel main project");
        $this->line("  --ssl            - SSL mode (auto|true|false, default: auto)");
        $this->line("  --php-version    - PHP version (default: 8.2)");
        $this->line("  --all            - Apply to all websites (for refresh)");
        $this->line("");
        $this->info("Examples:");
        $this->line("  php artisan servermanager:website add local.example.com --type=html");
        $this->line("  php artisan servermanager:website add api.example.com --type=poly");
        $this->line("  php artisan servermanager:website add example.com --type=laravel");
        $this->line("  php artisan servermanager:website list");
        $this->line("  php artisan servermanager:website status example.com");
        $this->line("  php artisan servermanager:website refresh example.com");
        $this->line("  php artisan servermanager:website refresh --all");

        return 0;
    }
}
