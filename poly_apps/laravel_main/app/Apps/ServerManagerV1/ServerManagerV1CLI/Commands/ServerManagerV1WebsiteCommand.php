<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands;

use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1DomainManager;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1CertificateManager;
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
                            {action : Action to perform (add|list|summary|status|remove)}
                            {domain? : Domain name (required for add, status, remove)}
                            {--type= : Website type (default: laravel)}
                            {--ssl= : SSL mode (auto|true|false, default: auto)}
                            {--php-version= : PHP version (default: 8.2)}';

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
        $phpVersion = $this->option('php-version') ?: '8.2';

        // EXTENDED FEATURE: Check for domain conflict
        $conflict = ServerManagerV1DomainManager::checkDomainConflict($domain);

        if ($conflict) {
            $this->warn("⚠️  Domain already exists: $domain");
            $this->line("");
            $this->info("Current configuration:");
            $this->line("  Type: " . $conflict['type']);
            $this->line("  Directory: " . $conflict['www_dir']);
            $this->line("  Status: " . $conflict['status']);
            $this->line("");

            // Calculate what will change
            $domainDir = $this->getDomainDirectory($domain, $type);
            $willMigrate = $domainDir !== $conflict['www_dir'];

            if ($willMigrate) {
                $this->warn("⚠️  This will MIGRATE the domain:");
                $this->line("  From: " . $conflict['www_dir'] . " (" . $conflict['type'] . ")");
                $this->line("  To:   " . $domainDir . " (" . $type . ")");
                $this->line("");

                // Check if old site will be affected
                $oldSiteDomains = ServerManagerV1DomainManager::findSitesByDirectory($conflict['www_dir']);
                if (count($oldSiteDomains) === 1) {
                    $this->error("⚠️  WARNING: This is the LAST domain for the old site!");
                    $this->warn("  The old site configuration will become orphaned.");
                    $this->warn("  Files in " . $conflict['www_dir'] . " will be preserved.");
                } else {
                    $this->info("ℹ️  Old site has " . (count($oldSiteDomains) - 1) . " other domain(s):");
                    foreach ($oldSiteDomains as $siteDomain) {
                        if ($siteDomain['domain'] !== $domain) {
                            $this->line("    - " . $siteDomain['domain']);
                        }
                    }
                }
                $this->line("");
            } else {
                $this->info("ℹ️  Configuration will be UPDATED (same directory)");
                $this->line("");
            }

            if (!$this->confirm('Continue?', false)) {
                $this->info('Operation cancelled');
                return 0;
            }
            $this->line("");
        }

        $this->info("Adding website: $domain");
        $this->info("Type: $type");
        $this->info("SSL mode: $sslMode");
        $this->info("PHP version: $phpVersion");

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

        $this->info("Base domain: $baseDomain");
        if ($wwwDomain) {
            $this->info("WWW domain: $wwwDomain");
        } else {
            $this->info("WWW domain: (not applicable for subdomain)");
        }

        // Check for existing certificate
        $certificate = null;
        $sslEnabled = false;

        if ($sslMode === 'auto' || $sslMode === 'true') {
            $certificate = ServerManagerV1CertificateManager::findCertificateForDomain($baseDomain);
            if ($certificate) {
                $sslEnabled = true;
                $this->info("Found certificate: " . $certificate['id']);
                $this->info("Certificate covers: " . implode(', ', $certificate['domains']));
            } else {
                $this->warn("No certificate found for domain, using HTTP");
                if ($sslMode === 'true') {
                    $this->error("SSL required but no certificate found");
                    return 1;
                }
            }
        }

        // Determine directory based on domain and type
        $domainDir = $this->getDomainDirectory($domain, $type);
        $documentRoot = $this->getDocumentRoot($domainDir, $type);

        $this->info("Domain directory: $domainDir");
        $this->info("Document root: $documentRoot");
        $this->info("Website type: $type");

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
            $this->info("Using existing Laravel directory");
        } else {
            // For html and laravel types, create directories in mapped wwwroot
            if (!is_dir($domainDir)) {
                $this->info("Creating domain directory: $domainDir");
                if (!mkdir($domainDir, 0755, true)) {
                    $this->error("Failed to create domain directory");
                    return 1;
                }
            }

            // Create document root if different from domain dir
            if ($documentRoot !== $domainDir && !is_dir($documentRoot)) {
                $this->info("Creating document root: $documentRoot");
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
            'status' => 'active',
            'all_domains' => $allDomains  // Pass all domains to generate single config
        ]);

        // No need to add www domain separately - it's handled in the same config
        $wwwResult = true;

        if ($domainResult && $wwwResult) {
            $this->info("Website added successfully!");
            $this->info("SSL enabled: " . ($sslEnabled ? 'yes' : 'no'));
            $this->info("Website directory: $domainDir");

            // Show nginx configuration file location using PathConfig
            $nginxConfigFile = ServerManagerV1PathConfig::getNginxSiteConfig($domain, false);
            $nginxEnabledFile = ServerManagerV1PathConfig::getNginxEnabledSite($domain);

            if ($sslEnabled) {
                $nginxSslConfigFile = ServerManagerV1PathConfig::getNginxSiteConfig($domain, true);
                $this->info("Nginx HTTP config: $nginxConfigFile (backup)");
                $this->info("Nginx HTTPS config: $nginxSslConfigFile (active)");
                $this->info("Nginx enabled file: $nginxEnabledFile -> $nginxSslConfigFile");
            } else {
                $this->info("Nginx HTTP config: $nginxConfigFile (active)");
                $this->info("Nginx enabled file: $nginxEnabledFile -> $nginxConfigFile");
            }

            if ($sslEnabled) {
                $this->info("Certificate ID: " . $certificate['id']);
                // Show certificate file locations using PathConfig
                $certDir = ServerManagerV1PathConfig::getSslCertDir($baseDomain);
                $this->info("SSL certificate: $certDir/fullchain.pem");
                $this->info("SSL private key: $certDir/privkey.pem");
            }

            $this->warn("⚠️  IMPORTANT: Restart nginx to load the new configuration:");
            $this->warn("   sudo systemctl restart nginx");
            $this->warn("   sudo systemctl status nginx");
            $this->warn("");
            $this->warn("📋 Check nginx main configuration includes sites-enabled:");
            // Use PathMapper for environment-aware paths (no hardcoded paths)
            // NGINX_MAIN_CONFIG is /etc/nginx/nginx.conf which is a system path, use PathMapper::findActualPath
            $nginxMainConfig = \App\Providers\PathMapper::findActualPath('/etc/nginx/nginx.conf');
            $nginxSitesEnabled = ServerManagerV1PathConfig::getNginxSitesEnabled();
            $this->warn("   Main config: $nginxMainConfig");
            $this->warn("   Should include: include $nginxSitesEnabled/*;");
            $this->warn("");
            $this->warn("💡 TIP: Use 'php artisan servermanager:sync' to clean up old configurations");

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

        $this->warn("This will remove the website configuration for: $domain");
        $this->warn("Files in " . $config['www_dir'] . " will NOT be deleted");

        if (!$this->confirm("Are you sure you want to remove this website?")) {
            $this->info("Operation cancelled");
            return 0;
        }

        $result = ServerManagerV1DomainManager::removeDomain($domain);

        if ($result) {
            $this->info("Website removed successfully: $domain");
            return 0;
        } else {
            $this->error("Failed to remove website: $domain");
            return 1;
        }
    }

    /**
     * Get domain directory based on domain and type
     */
    private function getDomainDirectory(string $domain, string $type): string
    {
        // For poly type, always use Laravel main directory
        if ($type === 'poly') {
            // Get Laravel main directory relative to current location
            $laravelDir = dirname(dirname(dirname(dirname(dirname(__DIR__)))));
            return $laravelDir;
        }

        // For API domains with Laravel type, use Laravel main directory
        if (strpos($domain, 'api.') === 0 && $type === 'laravel') {
            // Get Laravel main directory relative to current location
            $laravelDir = dirname(dirname(dirname(dirname(dirname(__DIR__)))));
            return $laravelDir;
        }

        // For local domains or HTML type, use www directory
        if (strpos($domain, 'local.') === 0) {
            $baseDomain = substr($domain, 6); // Remove 'local.' prefix
            $wwwRoot = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getWwwRoot();
            return "$wwwRoot/$baseDomain";
        }

        // Default: use domain name as directory
        $baseDomain = $domain;
        if (strpos($baseDomain, 'www.') === 0) {
            $baseDomain = substr($baseDomain, 4);
        }

        $wwwRoot = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getWwwRoot();
        return "$wwwRoot/$baseDomain";
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
        $this->line("");
        $this->info("Options:");
        $this->line("  --type           - Website type: html|laravel|poly (default: laravel)");
        $wwwRoot = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getWwwRoot();
        $this->line("                     html: Static files in $wwwRoot/domain");
        $this->line("                     laravel: Laravel project in $wwwRoot/domain");
        $this->line("                     poly: Bind to current Laravel main project");
        $this->line("  --ssl            - SSL mode (auto|true|false, default: auto)");
        $this->line("  --php-version    - PHP version (default: 8.2)");
        $this->line("");
        $this->info("Examples:");
        $this->line("  php artisan servermanager:website add local.example.com --type=html");
        $this->line("  php artisan servermanager:website add api.example.com --type=poly");
        $this->line("  php artisan servermanager:website add example.com --type=laravel");
        $this->line("  php artisan servermanager:website list");
        $this->line("  php artisan servermanager:website status example.com");

        return 0;
    }
}
