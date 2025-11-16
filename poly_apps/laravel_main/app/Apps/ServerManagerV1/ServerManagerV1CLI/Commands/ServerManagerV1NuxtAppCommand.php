<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands;

use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1DomainManager;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1NuxtServiceManager;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1CertificateManager;
use App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig;
use App\Providers\PathMapper;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

class ServerManagerV1NuxtAppCommand extends ServerManagerV1BaseCommand
{
    protected $signature = 'servermanager:nuxt
                            {action : Action to perform (add|remove|rebuild|restart|status|list)}
                            {appname? : Nuxt app namespace (e.g., ittools, pymatrix)}
                            {--domain= : Domain name for nginx proxy}
                            {--port= : Port number (default: auto-assign)}
                            {--ssl= : SSL mode (auto|true|false, default: auto)}';

    protected $description = 'Manage Nuxt poly apps with build, service, and nginx integration';

    private $nuxtMainPath;
    private $factoryBasePath;
    private $switchScript;
    private $startScriptPs1;

    public function __construct()
    {
        parent::__construct();

        // PathMapper::getCoreNodeDir() returns /www/programing (parent of core_node)
        // We need to add /core_node to get to the actual core_node directory
        $programmingPath = PathMapper::getCoreNodeDir();
        $coreNodePath = "$programmingPath/core_node";
        $this->nuxtMainPath = "$coreNodePath/poly_apps/nuxt_main";
        $this->switchScript = "$this->nuxtMainPath/scripts/switch-app-entry-plus.js";
        $this->startScriptPs1 = "$this->nuxtMainPath/scripts/start.ps1";

        $baseDataDir = PathMapper::mapWebPath('www');
        $this->factoryBasePath = str_replace('/www', '', $baseDataDir) . '/_build_dir/nuxt_factory/linux';
    }

    public function handle(): int
    {
        $this->initializeCommand();

        $action = $this->argument('action');
        $appname = $this->argument('appname');

        return match($action) {
            'add' => $this->addPolyApp($appname),
            'remove' => $this->removePolyApp($appname),
            'rebuild' => $this->rebuildPolyApp($appname),
            'restart' => $this->restartPolyApp($appname),
            'status' => $this->showPolyAppStatus($appname),
            'list' => $this->listPolyApps(),
            default => $this->showHelp()
        };
    }

    private function addPolyApp(?string $appname): int
    {
        if (!$appname) {
            $this->error("App name is required for add action");
            return 1;
        }

        $domain = $this->option('domain') ?: "$appname.local";
        $port = $this->option('port') ?: ServerManagerV1NuxtServiceManager::findAvailablePort();
        $sslMode = $this->option('ssl') ?: 'auto';

        $this->info("Adding Nuxt PolyApp: $appname");
        $this->info("Domain: $domain, Port: $port");

        if ($this->checkIfPolyAppExists($appname)) {
            $this->warn("PolyApp $appname already exists. Fixing and resetting...");
            $this->fixAndResetPolyApp($appname, $domain, $port, $sslMode);
            return 0;
        }

        $steps = [
            'Validating app namespace',
            'Installing node_modules',
            'Copying to factory directory',
            'Building application',
            'Creating systemd service',
            'Configuring nginx proxy',
            'Starting service'
        ];

        $this->info("Starting deployment with " . count($steps) . " steps...");

        foreach ($steps as $index => $step) {
            $stepNum = $index + 1;
            $this->info("[$stepNum/" . count($steps) . "] $step");

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

            if (!$result) {
                $this->error("Step failed: $step");
                return 1;
            }
        }

        $this->info("Successfully deployed Nuxt PolyApp: $appname");
        $this->info("Access at: http" . ($sslMode !== 'false' ? 's' : '') . "://$domain");

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

        $nodeCmd = "node";
        $switchCmd = "$nodeCmd $this->switchScript $appname --factory-root=$this->factoryBasePath --mode=build --no-watch --no-build";

        $result = Process::path($this->nuxtMainPath)
            ->timeout(120)
            ->run($switchCmd);

        if ($result->failed()) {
            $this->error("Failed to copy to factory");
            $this->error($result->errorOutput());
            return false;
        }

        if (!is_dir($factoryPath)) {
            $this->error("Factory directory not created: $factoryPath");
            return false;
        }

        $this->comment("✓ Workspace copied to factory");
        return true;
    }

    private function buildApp(string $appname): bool
    {
        $factoryPath = "$this->factoryBasePath/_app_$appname";

        $this->comment("Building Nuxt app in factory...");

        $packageManager = $this->detectPackageManager();
        $buildCmd = match($packageManager) {
            'pnpm' => "cd $factoryPath && pnpm build:$appname",
            'yarn' => "cd $factoryPath && yarn build:$appname",
            default => "cd $factoryPath && npm run build:$appname"
        };

        $result = Process::timeout(600)->run($buildCmd);

        if ($result->failed()) {
            $this->error("Build failed");
            $this->error($result->errorOutput());
            return false;
        }

        $outputPath = "$factoryPath/.output";
        if (!is_dir($outputPath)) {
            $this->error("Build output not found: $outputPath");
            return false;
        }

        $this->comment("✓ App built successfully");
        return true;
    }

    private function createService(string $appname, int $port): bool
    {
        $serviceName = ServerManagerV1NuxtServiceManager::getNuxtServiceName($appname);

        if (ServerManagerV1NuxtServiceManager::serviceExists($serviceName)) {
            $this->comment("Service $serviceName already exists, recreating...");
            ServerManagerV1NuxtServiceManager::removeService($serviceName);
        }

        if (!ServerManagerV1NuxtServiceManager::createServiceFile($appname, $port)) {
            $this->error("Failed to create service file");
            return false;
        }

        if (!ServerManagerV1NuxtServiceManager::enableService($serviceName)) {
            $this->error("Failed to enable service");
            return false;
        }

        $this->comment("✓ Service created: $serviceName");
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

        $this->removeService("nuxt-$appname");

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
        $this->line("");
        $this->line("Examples:");
        $this->line("  php artisan servermanager:nuxt add ittools --domain=tools.local");
        $this->line("  php artisan servermanager:nuxt rebuild pymatrix");
        $this->line("  php artisan servermanager:nuxt list");

        return 0;
    }
}
