<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands;

use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1DomainManager;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1NuxtServiceManager;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1CertificateManager;
use App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig;
use App\Providers\PathMapper;
use App\Utils\SystemUtil;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

class ServerManagerV1NuxtAppCommand extends ServerManagerV1BaseCommand
{
    protected $signature = 'servermanager:nuxt
                            {action : Action to perform (add|remove|rebuild|restart|status|list|fix|watch)}
                            {appname? : Nuxt app namespace (e.g., ittools, pymatrix)}
                            {--domain= : Domain name for nginx proxy}
                            {--port= : Port number (default: auto-assign)}
                            {--ssl= : SSL mode (auto|true|false, default: auto)}
                            {--debug : Enable debug mode (runs from source instead of factory build)}
                            {--follow : Follow logs in real-time (for watch action)}';

    protected $description = 'Manage Nuxt poly apps with build, service, and nginx integration';

    private $debugMode = false;

    private $nuxtMainPath;
    private $factoryBasePath;
    private $switchScript;
    private $startScriptPs1;

    public function __construct()
    {
        parent::__construct();

        // PathMapper::getCoreNodeDir() returns /www/programing/core_node
        $coreNodePath = PathMapper::getCoreNodeDir();
        $this->nuxtMainPath = "$coreNodePath/poly_apps/nuxt_main";
        $this->switchScript = "$this->nuxtMainPath/scripts/switch-app-entry-plus.js";
        $this->startScriptPs1 = "$this->nuxtMainPath/scripts/start.ps1";

        $baseDataDir = PathMapper::mapWebPath('www');
        $this->factoryBasePath = str_replace('/www', '', $baseDataDir) . '/_build_dir/nuxt_factory/linux';
    }

    public function handle(): int
    {
        $this->initializeCommand();

        // Enable debug mode if requested or auto-detect for WSL/desktop
        $this->debugMode = $this->option('debug') || SystemUtil::isWslDesktopEnvironment();

        if ($this->debugMode) {
            $this->info("🔍 Debug mode enabled");
            $this->debugInfo("Environment: " . (SystemUtil::isWslDesktopEnvironment() ? "WSL/Desktop" : "Production"));
            $this->debugInfo("Working directory: " . getcwd());
            $this->debugInfo("Nuxt main path: {$this->nuxtMainPath}");
            $this->debugInfo("Factory base path: {$this->factoryBasePath}");
        }

        $action = $this->argument('action');
        $appname = $this->argument('appname');

        return match($action) {
            'add' => $this->addPolyApp($appname),
            'remove' => $this->removePolyApp($appname),
            'rebuild' => $this->rebuildPolyApp($appname),
            'restart' => $this->restartPolyApp($appname),
            'status' => $this->showPolyAppStatus($appname),
            'list' => $this->listPolyApps(),
            'fix' => $this->fixPolyApp($appname),
            'watch' => $this->watchPolyApp($appname),
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

    private function addPolyApp(?string $appname): int
    {
        if (!$appname) {
            $availableApps = $this->getAvailableApps();

            $this->error("App name is required for add action");
            $this->line("");

            if (!empty($availableApps)) {
                $this->info("Available apps:");
                foreach ($availableApps as $app) {
                    $this->line("  - $app");
                }
                $this->line("");
            }

            $this->info("Usage examples:");
            $this->line("  php artisan servermanager:nuxt add ittools");
            $this->line("  php artisan servermanager:nuxt add pymatrix --domain=pymatrix.local");
            $this->line("  php artisan servermanager:nuxt add ittools --port=10001 --domain=ittools.local");
            return 1;
        }

        $domain = $this->option('domain') ?: "$appname.local";
        $port = $this->option('port') ?: ServerManagerV1NuxtServiceManager::findAvailablePort();
        $sslMode = $this->option('ssl') ?: 'auto';

        // Detect user for running Nuxt service
        // In WSL/Desktop: uses non-root user for proper file permissions
        // In production servers: uses root by default
        $user = SystemUtil::detectUser($this->debugMode);
        $this->debugInfo("Detected user: $user");
        $this->debugInfo("Is WSL/Desktop: " . (SystemUtil::isWslDesktopEnvironment() ? 'Yes' : 'No'));

        $mode = $this->debugMode ? 'Debug' : 'Production';
        $this->info("Adding Nuxt PolyApp: $appname ($mode Mode)");
        $this->info("Domain: $domain, Port: $port");

        if ($this->checkIfPolyAppExists($appname)) {
            $this->warn("PolyApp $appname already exists. Fixing and resetting...");
            $this->fixAndResetPolyApp($appname, $domain, $port, $sslMode);
            return 0;
        }

        // Define steps based on mode
        if ($this->debugMode) {
            $steps = [
                'Validating app namespace',
                'Installing node_modules (source)',
                'Preparing factory directory',
                'Copying to factory directory',
                'Ensuring permissions',
                'Installing factory dependencies',
                'Creating systemd service (debug mode)',
                'Configuring nginx proxy',
                'Starting service'
            ];
        } else {
            $steps = [
                'Validating app namespace',
                'Installing node_modules',
                'Copying to factory directory',
                'Building application',
                'Creating systemd service (production mode)',
                'Configuring nginx proxy',
                'Starting service'
            ];
        }

        $this->info("Starting deployment with " . count($steps) . " steps...");

        foreach ($steps as $index => $step) {
            $stepNum = $index + 1;
            $this->info("[$stepNum/" . count($steps) . "] $step");

            if ($this->debugMode) {
                $result = match($stepNum) {
                    1 => $this->validateAppNamespace($appname),
                    2 => $this->installNodeModules(),
                    3 => $this->prepareFactoryDirectory($appname),
                    4 => $this->copyToFactory($appname),
                    5 => $this->ensureFactoryPermissions($appname, $user),
                    6 => $this->ensureFactoryDependencies($appname, $user),
                    7 => $this->createService($appname, $port),
                    8 => $this->configureNginx($appname, $domain, $port, $sslMode),
                    9 => $this->startService($appname),
                    default => true
                };
            } else{
                $result = match($stepNum) {
                    1 => $this->validateAppNamespace($appname),
                    2 => $this->installNodeModules(),
                    3 => $this->copyToFactory($appname),
                    4 => $this->buildApp($appname),
                    5 => $this->createService($appname, $port),
                    6 => $this->configureNginx($appname, $domain, $port, $sslMode),
                    7 => $this->startService($appname),
                    default => true
                };
            }

            if (!$result) {
                $this->error("Step failed: $step");
                return 1;
            }
        }

        $this->info("Successfully deployed Nuxt PolyApp: $appname ($mode Mode)");
        $this->info("Access at: http" . ($sslMode !== 'false' ? 's' : '') . "://$domain");

        if ($this->debugMode) {
            $this->warn("⚠ Debug mode: Running directly from source. Changes will reload automatically.");
        }

        return 0;
    }

    private function validateAppNamespace(string $appname): bool
    {
        $indexFile = "$this->nuxtMainPath/pages/index.$appname.vue";

        if (!file_exists($indexFile)) {
            $this->error("Namespace not found: $indexFile does not exist");
            $this->comment("Available apps:");
            $this->listAvailableApps();
            return false;
        }

        $appDir = "$this->nuxtMainPath/apps/app_$appname";
        if (!is_dir($appDir)) {
            $this->error("App directory not found: $appDir");
            return false;
        }

        $this->comment("✓ App namespace validated: $appname");
        return true;
    }

    private function installNodeModules(): bool
    {
        $nodeModulesPath = "$this->nuxtMainPath/node_modules";

        if (is_dir($nodeModulesPath) && count(scandir($nodeModulesPath)) > 2) {
            $this->comment("✓ node_modules already installed");
            return true;
        }

        $packageManager = $this->detectPackageManager();

        $this->comment("Installing dependencies with $packageManager...");

        $installCmd = match($packageManager) {
            'pnpm' => 'pnpm install',
            'yarn' => 'yarn install',
            default => 'npm install --legacy-peer-deps'
        };

        $result = Process::path($this->nuxtMainPath)
            ->timeout(300)
            ->run($installCmd);

        if ($result->failed()) {
            $this->error("Failed to install node_modules");
            $this->error($result->errorOutput());
            return false;
        }

        $this->comment("✓ Dependencies installed");
        return true;
    }

    private function getAvailableApps(): array
    {
        $appsDir = "$this->nuxtMainPath/apps";

        if (!is_dir($appsDir)) {
            return [];
        }

        $apps = [];
        $dirs = scandir($appsDir);

        foreach ($dirs as $dir) {
            if ($dir === '.' || $dir === '..') {
                continue;
            }

            $fullPath = "$appsDir/$dir";
            if (is_dir($fullPath)) {
                $appName = str_replace('app_', '', $dir);
                $apps[] = $appName;
            }
        }

        return $apps;
    }

    private function detectPackageManager(): string
    {
        $checkPnpm = Process::run('which pnpm');
        if ($checkPnpm->successful()) {
            return 'pnpm';
        }

        $checkYarn = Process::run('which yarn');
        if ($checkYarn->successful()) {
            return 'yarn';
        }

        return 'npm';
    }


    private function copyToFactory(string $appname): bool
    {
        $factoryPath = "$this->factoryBasePath/_app_$appname";

        if (!is_dir($this->factoryBasePath)) {
            if (!mkdir($this->factoryBasePath, 0755, true)) {
                $this->error("Failed to create factory base directory");
                return false;
            }
        }

        $this->comment("Copying workspace to factory: $factoryPath");

        $excludes = ['node_modules', '.nuxt', '.output', '.git', '.app-backups', 'dist'];
        $excludeArgs = implode(' ', array_map(fn($e) => "--exclude='$e'", $excludes));

        $rsyncCmd = "rsync -a $excludeArgs $this->nuxtMainPath/ $factoryPath/";

        $result = Process::timeout(300)->run($rsyncCmd);

        if ($result->failed()) {
            $this->error("Failed to copy to factory");
            $this->error($result->errorOutput());
            return false;
        }

        $switchScript = "$factoryPath/scripts/switch-app-entry.js";
        if (!file_exists($switchScript)) {
            $this->error("Switch script not found after copy: $switchScript");
            return false;
        }

        $switchResult = Process::path($factoryPath)
            ->timeout(30)
            ->run("node scripts/switch-app-entry.js $appname");

        if ($switchResult->failed()) {
            $this->error("Failed to switch app entry");
            $this->error($switchResult->errorOutput());
            return false;
        }

        if (!is_dir($factoryPath)) {
            $this->error("Factory directory not created: $factoryPath");
            return false;
        }

        $this->comment("✓ Workspace copied to factory");
        return true;
    }

    private function prepareFactoryDirectory(string $appname): bool
    {
        $factoryPath = "$this->factoryBasePath/_app_$appname";

        // Create factory directory if it doesn't exist
        if (!is_dir($factoryPath)) {
            if (!mkdir($factoryPath, 0755, true)) {
                $this->error("Failed to create factory directory");
                return false;
            }
            $this->comment("✓ Factory directory created");
        } else {
            $this->comment("✓ Factory directory exists");
        }

        return true;
    }

    private function ensureFactoryPermissions(string $appname, string $user): bool
    {
        $factoryPath = "$this->factoryBasePath/_app_$appname";

        $this->comment("Ensuring proper permissions for factory directory...");

        // Fix ownership of factory directory
        $chownResult = Process::run("chown -R $user:$user $factoryPath");
        if ($chownResult->failed()) {
            $this->warn("Failed to set ownership, may cause permission issues");
            $this->debugInfo("chown error: " . $chownResult->errorOutput());
        }

        // Fix ownership of source node-compile-cache if it exists
        $cacheDir = "$this->nuxtMainPath/node-compile-cache";
        if (is_dir($cacheDir)) {
            $cacheFix = Process::run("chown -R $user:$user $cacheDir");
            if ($cacheFix->failed()) {
                $this->warn("Failed to fix node-compile-cache permissions");
            }
        }

        $this->comment("✓ Permissions configured");
        return true;
    }

    private function ensureFactoryDependencies(string $appname, string $user): bool
    {
        $factoryPath = "$this->factoryBasePath/_app_$appname";
        $nodeModulesPath = "$factoryPath/node_modules";

        // Check if node_modules exists and is populated
        if (is_dir($nodeModulesPath) && count(scandir($nodeModulesPath)) > 10) {
            $this->comment("✓ Factory dependencies already installed");
            return true;
        }

        $this->comment("Installing dependencies in factory (as $user)...");

        $packageManager = $this->detectPackageManager();
        $pmPath = match($packageManager) {
            'pnpm' => '/usr/local/bin/pnpm',
            'yarn' => 'yarn',
            default => 'npm'
        };

        $installCmd = "cd $factoryPath && echo 'y' | sudo -u $user $pmPath install";

        $this->debugInfo("Install command: $installCmd");
        $installResult = Process::timeout(600)->run($installCmd);

        if ($installResult->failed()) {
            $this->error("Failed to install factory dependencies");
            $this->error($installResult->errorOutput());
            return false;
        }

        $this->comment("✓ Factory dependencies installed");
        return true;
    }

    private function buildApp(string $appname): bool
    {
        $factoryPath = "$this->factoryBasePath/_app_$appname";
        $this->debugInfo("Factory path: $factoryPath");

        $nodeModulesPath = "$factoryPath/node_modules";
        if (!is_dir($nodeModulesPath) || count(scandir($nodeModulesPath)) <= 2) {
            $this->comment("Installing dependencies in factory directory...");

            $packageManager = $this->detectPackageManager();
            $this->debugInfo("Package manager: $packageManager");

            $installCmd = match($packageManager) {
                'pnpm' => "cd $factoryPath && pnpm install",
                'yarn' => "cd $factoryPath && yarn install",
                default => "cd $factoryPath && npm install --legacy-peer-deps"
            };

            $this->debugInfo("Install command: $installCmd");
            $installResult = Process::timeout(600)->run($installCmd);

            if ($installResult->failed()) {
                $this->error("Failed to install dependencies in factory");
                $this->error($installResult->errorOutput());
                if ($this->debugMode) {
                    $this->debugInfo("Install output: " . $installResult->output());
                }
                return false;
            }

            $this->comment("✓ Dependencies installed in factory");
        } else {
            $this->comment("✓ node_modules already exist in factory");
            $this->debugInfo("node_modules path: $nodeModulesPath");
        }

        $this->comment("Building Nuxt app in factory...");

        $packageManager = $this->detectPackageManager();
        $nodeOptions = "NODE_OPTIONS='--max-old-space-size=4096'";
        $buildCmd = match($packageManager) {
            'pnpm' => "cd $factoryPath && $nodeOptions pnpm build:$appname",
            'yarn' => "cd $factoryPath && $nodeOptions yarn build:$appname",
            default => "cd $factoryPath && $nodeOptions npm run build:$appname"
        };

        $this->debugInfo("Build command: $buildCmd");
        $result = Process::timeout(600)->run($buildCmd);

        if ($result->failed()) {
            $this->error("Build failed");
            $this->error($result->errorOutput());
            if ($this->debugMode) {
                $this->debugInfo("Build output: " . $result->output());
            }
            return false;
        }

        if ($this->debugMode && $result->output()) {
            $this->debugInfo("Build output preview: " . substr($result->output(), -500));
        }

        $outputPath = "$factoryPath/.output";
        if (!is_dir($outputPath)) {
            $this->error("Build output not found: $outputPath");
            return false;
        }

        $this->debugInfo("Output path: $outputPath");
        $this->debugInfo("Output directory contents: " . implode(', ', scandir($outputPath)));

        // Fix Nuxt static assets: Create symlink from server/chunks/public to public
        $chunksDir = "$outputPath/server/chunks";
        $publicSymlink = "$chunksDir/public";

        $this->debugInfo("Checking public symlink: $publicSymlink");

        if (!file_exists($publicSymlink)) {
            $this->comment("Creating public assets symlink...");

            // Ensure chunks directory exists
            if (!is_dir($chunksDir)) {
                $this->debugInfo("Creating chunks directory: $chunksDir");
                mkdir($chunksDir, 0755, true);
            }

            // Create symlink: public -> ../../public
            $symlinkCmd = "cd $chunksDir && ln -sf ../../public public";
            $this->debugInfo("Symlink command: $symlinkCmd");

            $symlinkResult = Process::run($symlinkCmd);

            if ($symlinkResult->failed()) {
                $this->warn("Failed to create public symlink (assets may not load correctly)");
                $this->warn($symlinkResult->errorOutput());
            } else {
                $this->comment("✓ Public assets symlink created");
                $this->debugInfo("Symlink created successfully");
            }
        } else {
            $this->debugInfo("Public symlink already exists");
        }

        $this->comment("✓ App built successfully");
        return true;
    }

    private function createService(string $appname, int $port): bool
    {
        $serviceName = ServerManagerV1NuxtServiceManager::getNuxtServiceName($appname);

        // Use smart service creation with auto-resolution of duplicates and mode refresh
        $result = ServerManagerV1NuxtServiceManager::createOrRefreshService(
            $appname,
            $port,
            null,
            $this->debugMode,
            true // auto-resolve duplicates
        );

        if (!$result['success']) {
            $this->error("Failed to create/refresh service");
            return false;
        }

        // Report what happened
        if (!empty($result['duplicates_removed'])) {
            $this->warn("Removed duplicate services: " . implode(', ', $result['duplicates_removed']));
        }

        if ($result['mode_changed']) {
            $this->info("Service mode changed from " . ($this->debugMode ? 'production' : 'debug') . " to {$result['mode']}");
        }

        $actionText = match($result['action']) {
            'created' => 'created',
            'refreshed' => 'refreshed',
            'refreshed_mode_change' => 'refreshed (mode changed)',
            default => 'updated'
        };

        $this->comment("✓ Service {$actionText}: $serviceName ({$result['mode']} mode)");
        return true;
    }


    private function configureNginx(string $appname, string $domain, int $port, string $sslMode): bool
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

        $nginxConfig = $this->generateNginxConfig($appname, $domain, $port, $sslEnabled, $certificate);

        $nginxPath = PathMapper::mapWebPath('nginxconfig');
        $sitesAvailable = "$nginxPath/sites-available";
        $sitesEnabled = "$nginxPath/sites-enabled";

        if (!is_dir($sitesAvailable)) {
            mkdir($sitesAvailable, 0755, true);
        }
        if (!is_dir($sitesEnabled)) {
            mkdir($sitesEnabled, 0755, true);
        }

        $configFile = "$sitesAvailable/nuxt-$appname.conf";

        if (!file_put_contents($configFile, $nginxConfig)) {
            $this->error("Failed to write nginx config");
            return false;
        }

        $symlinkPath = "$sitesEnabled/nuxt-$appname.conf";
        if (!file_exists($symlinkPath)) {
            symlink($configFile, $symlinkPath);
        }

        $testResult = Process::run('nginx -t');
        if ($testResult->failed()) {
            $this->error("Nginx configuration test failed");
            $this->error($testResult->errorOutput());
            return false;
        }

        Process::run('systemctl reload nginx');

        $this->comment("✓ Nginx configured for domain: $domain");
        return true;
    }

    private function generateNginxConfig(string $appname, string $domain, int $port, bool $sslEnabled, ?array $certificate): string
    {
        $serverName = $domain;

        if (!str_starts_with($domain, 'www.')) {
            $serverName .= " www.$domain";
        }

        $sslConfig = '';
        if ($sslEnabled && $certificate) {
            $sslConfig = <<<SSL

    ssl_certificate {$certificate['cert_path']};
    ssl_certificate_key {$certificate['key_path']};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
SSL;
        }

        $listenDirective = $sslEnabled ? "443 ssl http2" : "80";

        return <<<NGINX
server {
    listen $listenDirective;
    listen [::]:$listenDirective;
    server_name $serverName;
$sslConfig

    location / {
        proxy_pass http://127.0.0.1:$port;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX;
    }

    private function startService(string $appname): bool
    {
        $serviceName = ServerManagerV1NuxtServiceManager::getNuxtServiceName($appname);

        if (!ServerManagerV1NuxtServiceManager::startService($serviceName)) {
            $this->error("Failed to start service");
            $this->comment("Logs:");
            $this->line(ServerManagerV1NuxtServiceManager::getServiceLogs($serviceName, 20));
            return false;
        }

        $this->comment("✓ Service started successfully");
        return true;
    }

    private function fixAndResetPolyApp(string $appname, string $domain, int $port, string $sslMode): bool
    {
        $this->info("Fixing and resetting PolyApp: $appname");

        $serviceName = ServerManagerV1NuxtServiceManager::getNuxtServiceName($appname);
        ServerManagerV1NuxtServiceManager::removeService($serviceName);

        $factoryPath = "$this->factoryBasePath/_app_$appname";
        if (is_dir($factoryPath)) {
            $this->comment("Removing old factory directory");
            Process::run("rm -rf $factoryPath");
        }

        $this->info("Rebuilding from scratch...");
        return $this->addPolyApp($appname) === 0;
    }

    private function removePolyApp(?string $appname): int
    {
        if (!$appname) {
            $this->error("App name is required");
            return 1;
        }

        $this->info("Removing Nuxt PolyApp: $appname");

        $serviceName = ServerManagerV1NuxtServiceManager::getNuxtServiceName($appname);
        ServerManagerV1NuxtServiceManager::removeService($serviceName);

        $nginxPath = PathMapper::mapWebPath('nginxconfig');
        $configFile = "$nginxPath/sites-available/nuxt-$appname.conf";
        $symlinkFile = "$nginxPath/sites-enabled/nuxt-$appname.conf";

        if (file_exists($symlinkFile)) {
            unlink($symlinkFile);
        }
        if (file_exists($configFile)) {
            unlink($configFile);
        }

        Process::run('nginx -t && systemctl reload nginx');

        $factoryPath = ServerManagerV1NuxtServiceManager::getFactoryPath($appname);
        if (is_dir($factoryPath)) {
            Process::run("rm -rf $factoryPath");
        }

        $this->info("Successfully removed PolyApp: $appname");
        return 0;
    }

    private function rebuildPolyApp(?string $appname): int
    {
        if (!$appname) {
            $this->error("App name is required");
            return 1;
        }

        $this->info("Rebuilding Nuxt PolyApp: $appname");

        $serviceName = ServerManagerV1NuxtServiceManager::getNuxtServiceName($appname);
        ServerManagerV1NuxtServiceManager::stopService($serviceName);

        if (!$this->copyToFactory($appname)) {
            return 1;
        }

        if (!$this->buildApp($appname)) {
            return 1;
        }

        $port = ServerManagerV1NuxtServiceManager::findPortForApp($appname)
            ?? ServerManagerV1NuxtServiceManager::findAvailablePort();

        if (!$this->createService($appname, $port)) {
            return 1;
        }

        if (!$this->startService($appname)) {
            return 1;
        }

        $this->info("Successfully rebuilt PolyApp: $appname");
        return 0;
    }

    private function restartPolyApp(?string $appname): int
    {
        if (!$appname) {
            $this->error("App name is required");
            return 1;
        }

        $serviceName = ServerManagerV1NuxtServiceManager::getNuxtServiceName($appname);

        if (!ServerManagerV1NuxtServiceManager::restartService($serviceName)) {
            $this->error("Failed to restart service");
            return 1;
        }

        $this->info("Service restarted successfully: $serviceName");
        return 0;
    }

    private function showPolyAppStatus(?string $appname): int
    {
        if (!$appname) {
            $this->error("App name is required");
            return 1;
        }

        $serviceInfo = ServerManagerV1NuxtServiceManager::getServiceInfo($appname);

        if (!$serviceInfo) {
            $this->error("Service not found for app: $appname");
            return 1;
        }

        $this->info("Nuxt PolyApp Status: $appname");
        $this->table(
            ['Property', 'Value'],
            [
                ['Service Name', $serviceInfo['service_name']],
                ['Port', $serviceInfo['port'] ?? 'N/A'],
                ['Factory Path', $serviceInfo['factory_path']],
                ['Status', $serviceInfo['status']],
                ['Active', $serviceInfo['active'] ? 'Yes' : 'No'],
                ['Enabled', $serviceInfo['enabled'] ? 'Yes' : 'No'],
                ['Output Built', $serviceInfo['output_exists'] ? 'Yes' : 'No'],
            ]
        );

        $this->line("");
        $this->comment("Recent logs:");
        $this->line(ServerManagerV1NuxtServiceManager::getServiceLogs($serviceInfo['service_name'], 10));

        return 0;
    }

    private function listPolyApps(): int
    {
        $this->info("Installed Nuxt PolyApps:");

        $servicesInfo = ServerManagerV1NuxtServiceManager::getAllServicesInfo();

        if (empty($servicesInfo)) {
            $this->comment("No Nuxt PolyApps found");
            return 0;
        }

        $tableData = [];
        foreach ($servicesInfo as $info) {
            $tableData[] = [
                $info['app_name'],
                $info['port'] ?? 'N/A',
                $info['active'] ? 'Active' : 'Inactive',
                $info['enabled'] ? 'Yes' : 'No',
                $info['output_exists'] ? 'Yes' : 'No',
            ];
        }

        $this->table(
            ['App Name', 'Port', 'Status', 'Enabled', 'Built'],
            $tableData
        );

        return 0;
    }

    private function checkIfPolyAppExists(string $appname): bool
    {
        $serviceName = ServerManagerV1NuxtServiceManager::getNuxtServiceName($appname);
        return ServerManagerV1NuxtServiceManager::serviceExists($serviceName);
    }

    private function listAvailableApps(): void
    {
        $pagesDir = "$this->nuxtMainPath/pages";
        $apps = [];

        foreach (scandir($pagesDir) as $file) {
            if (preg_match('/^index\.(\w+)\.vue$/', $file, $matches)) {
                $apps[] = $matches[1];
            }
        }

        foreach ($apps as $app) {
            $this->comment("  - $app");
        }
    }

        /**
     * Fix service - detect and repair issues
     */
    private function fixPolyApp(string $appname): int
    {
        if (!$appname) {
            $this->error("App name is required for fix action");
            return 1;
        }

        $this->info("Fixing Nuxt PolyApp: $appname");

        $serviceName = ServerManagerV1NuxtServiceManager::getNuxtServiceName($appname);

        // Step 1: Check if service exists
        if (!ServerManagerV1NuxtServiceManager::serviceExists($serviceName)) {
            $this->warn("Service $serviceName does not exist");
            return 1;
        }

        // Step 2: Get current status
        $status = ServerManagerV1NuxtServiceManager::getServiceStatus($serviceName);
        $this->info("Current status: " . $status['status']);

        // Step 3: Detect mode
        $currentMode = ServerManagerV1NuxtServiceManager::detectServiceMode($serviceName);
        $this->info("Current mode: " . ($currentMode ?? 'unknown'));

        // Step 4: Get port
        $port = ServerManagerV1NuxtServiceManager::findPortForApp($appname);
        if (!$port) {
            $this->warn("Port not found, using default 3000");
            $port = 3000;
        }

        // Step 5: Refresh service with current mode
        $this->info("Refreshing service configuration...");
        $useDebugMode = ($currentMode === 'debug') || $this->debugMode;

        if (ServerManagerV1NuxtServiceManager::refreshService($appname, $port, null, $useDebugMode)) {
            $this->info("✓ Service configuration refreshed");

            // Step 6: Check logs for errors
            $this->info("Recent logs:");
            $logs = ServerManagerV1NuxtServiceManager::getServiceLogs($serviceName, 20);
            $this->line($logs);

            return 0;
        } else {
            $this->error("Failed to refresh service");
            return 1;
        }
    }

    /**
     * Watch service - monitor status and logs
     */
    private function watchPolyApp(string $appname): int
    {
        if (!$appname) {
            $this->error("App name is required for watch action");
            return 1;
        }

        $serviceName = ServerManagerV1NuxtServiceManager::getNuxtServiceName($appname);

        if (!ServerManagerV1NuxtServiceManager::serviceExists($serviceName)) {
            $this->error("Service $serviceName does not exist");
            return 1;
        }

        $this->info("Watching Nuxt PolyApp: $appname");
        $this->info("Press Ctrl+C to exit");
        $this->line("");

        $follow = $this->option('follow');

        if ($follow) {
            // Follow logs in real-time
            $this->info("Following logs...");
            $cmd = "journalctl -u $serviceName -f --no-pager";
            passthru($cmd);
        } else {
            // Show status loop
            while (true) {
                // Clear screen
                $this->line("\033[2J\033[H");

                $this->info("=== Nuxt PolyApp Status: $appname ===");
                $this->line("Time: " . date('Y-m-d H:i:s'));
                $this->line("");

                // Service status
                $status = ServerManagerV1NuxtServiceManager::getServiceStatus($serviceName);
                $mode = ServerManagerV1NuxtServiceManager::detectServiceMode($serviceName);
                $port = ServerManagerV1NuxtServiceManager::findPortForApp($appname);

                $this->line("Service: $serviceName");
                $this->line("Status: " . ($status['active'] ? '<fg=green>Active</>' : '<fg=red>Inactive</>'));
                $this->line("Mode: " . ($mode ?? 'unknown'));
                $this->line("Port: " . ($port ?? 'unknown'));
                $this->line("");

                // Test HTTP
                if ($port) {
                    $testResult = Process::run("curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$port/ 2>/dev/null");
                    $httpCode = trim($testResult->output());
                    $httpStatus = $httpCode === '200' ? '<fg=green>OK</>' : '<fg=red>Error</>';
                    $this->line("HTTP Test: $httpStatus (Code: $httpCode)");
                    $this->line("");
                }

                // Recent logs
                $this->info("Recent Logs:");
                $logs = ServerManagerV1NuxtServiceManager::getServiceLogs($serviceName, 10);
                $this->line($logs);

                sleep(3);
            }
        }

        return 0;
    }

    private function showHelp(): int
    {
        $this->info("Nuxt PolyApp Management");
        $this->line("");
        $this->line("Usage:");
        $this->line("  servermanager:nuxt add <appname> [--domain=<domain>] [--port=<port>] [--ssl=<auto|true|false>]");
        $this->line("  servermanager:nuxt remove <appname>");
        $this->line("  servermanager:nuxt rebuild <appname>");
        $this->line("  servermanager:nuxt restart <appname>");
        $this->line("  servermanager:nuxt status <appname>");
        $this->line("  servermanager:nuxt list");
        $this->line("  servermanager:nuxt fix <appname>        - Detect and repair service issues");
        $this->line("  servermanager:nuxt watch <appname>      - Monitor service status and logs");
        $this->line("  servermanager:nuxt watch <appname> --follow - Follow logs in real-time");
        $this->line("");
        $this->line("Examples:");
        $this->line("  php artisan servermanager:nuxt add ittools --domain=tools.local");
        $this->line("  php artisan servermanager:nuxt rebuild pymatrix");
        $this->line("  php artisan servermanager:nuxt fix ittools");
        $this->line("  php artisan servermanager:nuxt watch ittools --follow");
        $this->line("  php artisan servermanager:nuxt list");

        return 0;
    }
}
