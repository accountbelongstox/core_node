<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands;

use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1DomainManager;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1StaticServiceManager;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1CertificateManager;
use App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig;
use App\Providers\PathMapper;
use App\Utils\SystemUtil;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

class ServerManagerV1StaticAppCommand extends ServerManagerV1BaseCommand
{
    protected $signature = 'servermanager:static
                            {action : Action to perform (add|remove|restart|status|list)}
                            {appname? : Static app namespace (e.g., matrix_ui_react)}
                            {--domain= : Domain name for nginx proxy}
                            {--port= : Port number (required for add action)}
                            {--build-path= : Path to build output or source (required for add action)}
                            {--ssl= : SSL mode (auto|true|false, default: auto)}
                            {--debug : Enable debug mode (runs dev server instead of serving static files)}
                            {--follow : Follow logs in real-time (for watch/logs action)}';

    protected $description = 'Manage static web apps (React/Vue/Vite) with nginx integration';

    private $debugMode = false;

    public function handle(): int
    {
        $this->initializeCommand();

        // Enable debug mode if requested or auto-detect for WSL/desktop
        $this->debugMode = $this->option('debug') || SystemUtil::isWslDesktopEnvironment();

        if ($this->debugMode) {
            $this->info("🔍 Debug mode enabled");
            $this->debugInfo("Environment: " . (SystemUtil::isWslDesktopEnvironment() ? "WSL/Desktop" : "Production"));
        }

        $action = $this->argument('action');
        $appname = $this->argument('appname');

        return match($action) {
            'add' => $this->addStaticApp($appname),
            'remove' => $this->removeStaticApp($appname),
            'restart' => $this->restartStaticApp($appname),
            'status' => $this->showStaticAppStatus($appname),
            'list' => $this->listStaticApps(),
            default => $this->showHelp()
        };
    }

    /**
     * Output debug information
     */
    private function debugInfo(string $message): void
    {
        if ($this->debugMode) {
            $this->line("<fg=cyan>[DEBUG]</> $message");
        }
    }

    private function addStaticApp(?string $appname): int
    {
        if (!$appname) {
            $this->error("App name is required for add action");
            $this->line("");
            $this->info("Usage examples:");
            $this->line("  php artisan servermanager:static add matrix_ui_react --port=3456 --build-path=/path/to/dist");
            $this->line("  php artisan servermanager:static add matrix_ui_react --port=3456 --build-path=/path/to/source --debug");
            $this->line("  php artisan servermanager:static add matrix_ui_react --port=3456 --build-path=/path/to/dist --domain=myapp.example.com");
            return 1;
        }

        // Validate required parameters
        $port = $this->option('port');
        $buildPath = $this->option('build-path');

        if (!$port) {
            $this->error("--port is required");
            return 1;
        }

        if (!$buildPath) {
            $this->error("--build-path is required");
            return 1;
        }

        // Validate build path exists
        if (!is_dir($buildPath)) {
            $this->error("Build path does not exist: $buildPath");
            return 1;
        }

        $domain = $this->option('domain') ?: "$appname.local";
        $sslMode = $this->option('ssl') ?: 'auto';

        // Run service as root to avoid permission issues
        $user = 'root';
        $this->debugInfo("Service will run as: $user");

        $mode = $this->debugMode ? 'Debug' : 'Production';
        $this->info("Adding Static App: $appname ($mode Mode)");
        $this->info("Domain: $domain, Port: $port");
        $this->info("Path: $buildPath");

        if ($this->checkIfStaticAppExists($appname)) {
            $this->warn("Static app $appname already exists. Removing old deployment...");
            $serviceName = ServerManagerV1StaticServiceManager::getStaticServiceName($appname);
            ServerManagerV1StaticServiceManager::removeService($serviceName);
            $this->info("Rebuilding from scratch...");
        }

        // Define steps based on mode
        if ($this->debugMode) {
            $steps = [
                'Validating build path',
                'Creating systemd service (debug mode)',
                'Configuring nginx proxy',
                'Starting dev server'
            ];
        } else {
            $steps = [
                'Validating build path',
                'Configuring nginx for static files',
                'Reloading nginx'
            ];
        }

        $this->info("Starting deployment with " . count($steps) . " steps...");

        foreach ($steps as $index => $step) {
            $stepNum = $index + 1;
            $this->info("[$stepNum/" . count($steps) . "] $step");

            if ($this->debugMode) {
                $result = match($stepNum) {
                    1 => $this->validateBuildPath($buildPath, true),
                    2 => $this->createService($appname, $buildPath, $port),
                    3 => $this->configureNginx($appname, $domain, $port, $sslMode, true),
                    4 => $this->startService($appname),
                    default => true
                };
            } else {
                $result = match($stepNum) {
                    1 => $this->validateBuildPath($buildPath, false),
                    2 => $this->configureNginx($appname, $domain, $port, $sslMode, false),
                    3 => $this->reloadNginx(),
                    default => true
                };
            }

            if (!$result) {
                $this->error("Step failed: $step");
                return 1;
            }
        }

        $this->info("Successfully deployed Static App: $appname ($mode Mode)");

        // Display domain binding information
        $this->newLine();
        $isDefaultDomain = str_ends_with($domain, '.local');
        if ($isDefaultDomain) {
            $this->comment("Domain Binding: Using default domain");
            $this->line("  └─ Default domain: http" . ($sslMode !== 'false' ? 's' : '') . "://$domain");
            if ($this->debugMode) {
                $this->line("  └─ Direct access: http://127.0.0.1:$port");
            }
        } else {
            $this->comment("Domain Binding: Custom domain configured");
            $this->line("  └─ Domain: http" . ($sslMode !== 'false' ? 's' : '') . "://$domain");
            if ($this->debugMode) {
                $this->line("  └─ Port: $port");
            }
        }

        // Display service info for debug mode
        if ($this->debugMode) {
            $this->newLine();
            $serviceFile = "/etc/systemd/system/static-$appname.service";
            if (file_exists($serviceFile)) {
                $this->comment("Systemd Service Configuration:");
                $this->line("  └─ Service file: $serviceFile");
                $this->newLine();
                $serviceContent = file_get_contents($serviceFile);
                $this->line("─────────────────────────────────────────────────────────────────────────────");
                $this->line($serviceContent);
                $this->line("─────────────────────────────────────────────────────────────────────────────");
            }

            $this->newLine();
            $this->warn("⚠ Debug mode: Running dev server from source. Changes will reload automatically.");
        } else {
            $this->newLine();
            $this->info("✓ Production mode: Serving static files directly with nginx.");
        }

        return 0;
    }

    private function validateBuildPath(string $buildPath, bool $isDebugMode): bool
    {
        if (!is_dir($buildPath)) {
            $this->error("Build path not found: $buildPath");
            return false;
        }

        if ($isDebugMode) {
            // Debug mode: should be source directory with package.json
            if (!file_exists("$buildPath/package.json")) {
                $this->error("Source directory missing package.json: $buildPath");
                return false;
            }
            $this->comment("✓ Source path validated: $buildPath");
        } else {
            // Production mode: should have dist/ or build/ or index.html
            $hasDistDir = is_dir("$buildPath/dist");
            $hasBuildDir = is_dir("$buildPath/build");
            $hasIndexHtml = file_exists("$buildPath/index.html");

            if (!$hasDistDir && !$hasBuildDir && !$hasIndexHtml) {
                $this->warn("Build path may not contain built output");
                $this->comment("Expected: dist/ or build/ directory, or index.html");
                $this->comment("Found: " . implode(', ', array_slice(scandir($buildPath), 2)));
            }
            $this->comment("✓ Build path validated: $buildPath");
        }

        return true;
    }

    private function createService(string $appname, string $sourcePath, int $port): bool
    {
        $serviceName = ServerManagerV1StaticServiceManager::getStaticServiceName($appname);

        // Create service for debug mode
        $result = ServerManagerV1StaticServiceManager::createOrRefreshService(
            $appname,
            $sourcePath,
            $port,
            null,
            true, // debug mode
            true  // auto-resolve duplicates
        );

        if (!$result['success']) {
            $this->error("Failed to create/refresh service");
            return false;
        }

        // Report what happened
        if (!empty($result['duplicates_removed'])) {
            $this->warn("Removed duplicate services: " . implode(', ', $result['duplicates_removed']));
        }

        if ($result['port_changed']) {
            $this->info("Service port changed from {$result['old_port']} to {$result['new_port']}");
        }

        $actionText = match($result['action']) {
            'created' => 'created',
            'refreshed_no_change' => 'refreshed',
            'refreshed_port_change' => 'refreshed (port changed)',
            default => 'updated'
        };

        $this->comment("✓ Service {$actionText}: $serviceName (debug mode)");
        return true;
    }

    private function startService(string $appname): bool
    {
        $serviceName = ServerManagerV1StaticServiceManager::getStaticServiceName($appname);

        if (!ServerManagerV1StaticServiceManager::startService($serviceName)) {
            $this->error("Failed to start service");

            // Show recent logs
            $this->newLine();
            $this->error("Recent logs:");
            $logs = ServerManagerV1StaticServiceManager::getServiceLogs($serviceName, 20);
            $this->line($logs);

            return false;
        }

        // Wait a moment for service to start
        sleep(2);

        // Check if service is running
        $status = ServerManagerV1StaticServiceManager::getServiceStatus($serviceName);
        if (!$status['active']) {
            $this->error("Service started but is not active");
            $this->error("Status: " . $status['status']);

            // Show recent logs
            $this->newLine();
            $this->error("Recent logs:");
            $logs = ServerManagerV1StaticServiceManager::getServiceLogs($serviceName, 20);
            $this->line($logs);

            return false;
        }

        $this->comment("✓ Service started and running");
        return true;
    }

    private function configureNginx(string $appname, string $domain, int $port, string $sslMode, bool $isProxy): bool
    {
        $certificate = null;
        $sslEnabled = false;

        if ($sslMode === 'auto' || $sslMode === 'true') {
            $baseDomain = preg_replace('/^www\./', '', $domain);
            $certificate = ServerManagerV1CertificateManager::findCertificateForDomain($baseDomain);

            if ($certificate) {
                $sslEnabled = true;
            } elseif ($sslMode === 'true') {
                $this->error("SSL required but no certificate found");
                return false;
            }
        }

        $nginxConfig = $isProxy
            ? $this->generateNginxProxyConfig($appname, $domain, $port, $sslEnabled, $certificate)
            : $this->generateNginxStaticConfig($appname, $domain, $sslEnabled, $certificate);

        $nginxPath = PathMapper::mapWebPath('nginxconfig');
        $sitesAvailable = "$nginxPath/sites-available";
        $sitesEnabled = "$nginxPath/sites-enabled";

        $configFile = "$sitesAvailable/$appname.conf";
        $symlinkFile = "$sitesEnabled/$appname.conf";

        // Write nginx config
        if (!file_put_contents($configFile, $nginxConfig)) {
            $this->error("Failed to write nginx config");
            return false;
        }

        // Create symlink
        if (file_exists($symlinkFile)) {
            unlink($symlinkFile);
        }
        symlink($configFile, $symlinkFile);

        $this->comment("✓ Nginx configured for $domain");
        return true;
    }

    private function generateNginxProxyConfig(string $appname, string $domain, int $port, bool $sslEnabled, $certificate): string
    {
        $proxyConfig = "
    location / {
        proxy_pass http://localhost:$port;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }";

        if ($sslEnabled && $certificate) {
            return <<<NGINX
server {
    listen 80;
    server_name $domain;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $domain;

    ssl_certificate {$certificate['cert_path']};
    ssl_certificate_key {$certificate['key_path']};

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
$proxyConfig
}
NGINX;
        } else {
            return <<<NGINX
server {
    listen 80;
    server_name $domain;
$proxyConfig
}
NGINX;
        }
    }

    private function generateNginxStaticConfig(string $appname, string $domain, bool $sslEnabled, $certificate): string
    {
        $buildPath = $this->option('build-path');

        // Determine actual static files directory
        if (is_dir("$buildPath/dist")) {
            $rootPath = "$buildPath/dist";
        } elseif (is_dir("$buildPath/build")) {
            $rootPath = "$buildPath/build";
        } else {
            $rootPath = $buildPath;
        }

        $staticConfig = "
    root $rootPath;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control \"public, immutable\";
    }";

        if ($sslEnabled && $certificate) {
            return <<<NGINX
server {
    listen 80;
    server_name $domain;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $domain;

    ssl_certificate {$certificate['cert_path']};
    ssl_certificate_key {$certificate['key_path']};

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
$staticConfig
}
NGINX;
        } else {
            return <<<NGINX
server {
    listen 80;
    server_name $domain;
$staticConfig
}
NGINX;
        }
    }

    private function checkIfStaticAppExists(string $appname): bool
    {
        $serviceName = ServerManagerV1StaticServiceManager::getStaticServiceName($appname);
        return ServerManagerV1StaticServiceManager::serviceExists($serviceName);
    }

    private function removeStaticApp(?string $appname): int
    {
        if (!$appname) {
            $this->error("App name is required for remove action");
            return 1;
        }

        $this->info("Removing Static App: $appname");

        $serviceName = ServerManagerV1StaticServiceManager::getStaticServiceName($appname);

        // Remove service if exists
        if (ServerManagerV1StaticServiceManager::serviceExists($serviceName)) {
            if (!ServerManagerV1StaticServiceManager::removeService($serviceName)) {
                $this->error("Failed to remove service");
                return 1;
            }
            $this->comment("✓ Service removed");
        } else {
            $this->comment("✓ No service found (production mode or never existed)");
        }

        // Remove nginx config
        $nginxPath = PathMapper::mapWebPath('nginxconfig');
        $sitesAvailable = "$nginxPath/sites-available";
        $sitesEnabled = "$nginxPath/sites-enabled";

        $configFile = "$sitesAvailable/$appname.conf";
        $symlinkFile = "$sitesEnabled/$appname.conf";

        if (file_exists($symlinkFile)) {
            unlink($symlinkFile);
        }
        if (file_exists($configFile)) {
            unlink($configFile);
        }

        $this->reloadNginx();

        $this->info("Successfully removed Static App: $appname");
        return 0;
    }

    private function restartStaticApp(?string $appname): int
    {
        if (!$appname) {
            $this->error("App name is required for restart action");
            return 1;
        }

        $serviceName = ServerManagerV1StaticServiceManager::getStaticServiceName($appname);

        if (!ServerManagerV1StaticServiceManager::serviceExists($serviceName)) {
            $this->error("Service not found (app may be in production mode with no service)");
            return 1;
        }

        $this->info("Restarting Static App: $appname");

        if (!ServerManagerV1StaticServiceManager::restartService($serviceName)) {
            $this->error("Failed to restart service");
            return 1;
        }

        $this->info("Successfully restarted: $appname");
        return 0;
    }

    private function showStaticAppStatus(?string $appname): int
    {
        if (!$appname) {
            $this->error("App name is required for status action");
            return 1;
        }

        $serviceName = ServerManagerV1StaticServiceManager::getStaticServiceName($appname);
        $status = ServerManagerV1StaticServiceManager::getServiceStatus($serviceName);

        $this->info("Static App Status: $appname");
        $this->line("Service: " . $status['name']);
        $this->line("Exists: " . ($status['exists'] ? 'Yes' : 'No'));
        $this->line("Active: " . ($status['active'] ? 'Yes' : 'No'));
        $this->line("Enabled: " . ($status['enabled'] ? 'Yes' : 'No'));
        $this->line("Status: " . $status['status']);

        if (!$status['exists']) {
            $this->comment("Note: No service found. App may be running in production mode (static files served directly by nginx).");
        }

        // Show recent logs if service exists
        if ($status['exists']) {
            $this->newLine();
            $this->comment("Recent logs (last 20 lines):");
            $this->line("─────────────────────────────────────────────────────────────────────────────");
            $logs = ServerManagerV1StaticServiceManager::getServiceLogs($serviceName, 20);
            $this->line($logs);
            $this->line("─────────────────────────────────────────────────────────────────────────────");
        }

        return 0;
    }

    private function listStaticApps(): int
    {
        $services = ServerManagerV1StaticServiceManager::listStaticServices();

        if (empty($services)) {
            $this->info("No static app services found");
            $this->comment("Note: Apps in production mode (serving static files) don't have services.");
            return 0;
        }

        $this->info("Static App Services:");
        foreach ($services as $service) {
            $status = ServerManagerV1StaticServiceManager::getServiceStatus($service);
            $statusIcon = $status['active'] ? '🟢' : '🔴';
            $appname = str_replace('static-', '', $service);
            $port = ServerManagerV1StaticServiceManager::findPortForApp($appname);

            $this->line("  $statusIcon $appname (port: $port) - " . $status['status']);
        }

        return 0;
    }

    private function showHelp(): int
    {
        $this->error("Invalid action");
        $this->line("");
        $this->info("Available actions:");
        $this->line("  add     - Deploy a static app");
        $this->line("  remove  - Remove a static app deployment");
        $this->line("  restart - Restart a static app service (debug mode only)");
        $this->line("  status  - Show status of a static app");
        $this->line("  list    - List all static app services");
        $this->line("");
        $this->info("Examples:");
        $this->line("  php artisan servermanager:static add matrix_ui_react --port=3456 --build-path=/path/to/dist");
        $this->line("  php artisan servermanager:static add matrix_ui_react --port=3456 --build-path=/path/to/source --debug");
        $this->line("  php artisan servermanager:static status matrix_ui_react");
        $this->line("  php artisan servermanager:static list");
        return 1;
    }
}
