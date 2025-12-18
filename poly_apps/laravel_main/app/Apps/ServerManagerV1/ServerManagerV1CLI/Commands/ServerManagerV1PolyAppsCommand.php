<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands;

use App\Providers\PathMapper;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\DB;
use App\Apps\ServerManagerV1\ServerManagerV1Managers\ServerManagerV1DomainManager;
use App\Apps\ServerManagerV1\ServerManagerV1Managers\ServerManagerV1CertificateManager;

class ServerManagerV1PolyAppsCommand extends ServerManagerV1BaseCommand
{
    protected $signature = 'servermanager:poly_apps
                            {appname? : Application name to configure}
                            {domains? : Comma-separated domain list (domain1,domain2)}
                            {--show-apps : List all managed apps}
                            {--port= : Custom port (auto-assigned if not specified)}
                            {--ssl=auto : SSL mode: auto, true, false}';

    protected $description = 'Manage poly_apps - Configure services and reverse proxy (idempotent)';

    private string $coreNodeRoot;
    private string $appsDir;
    private int $basePort = 10000;

    public function __construct()
    {
        parent::__construct();

        $this->coreNodeRoot = PathMapper::getCoreNodeDir();
        $this->appsDir = "{$this->coreNodeRoot}/apps";
    }

    public function handle(): int
    {
        $this->initializeCommand();

        // Show apps list
        if ($this->option('show-apps')) {
            return $this->showManagedApps();
        }

        $appname = $this->argument('appname');

        if (!$appname) {
            return $this->showHelp();
        }

        $domains = $this->argument('domains');

        // Parse domains
        $domainList = [];
        if ($domains) {
            $domainList = array_map('trim', explode(',', $domains));
            $domainList = array_filter($domainList);
        }

        // Execute idempotent configuration
        if (empty($domainList)) {
            return $this->configureServiceOnly($appname);
        } else {
            return $this->configureServiceAndProxy($appname, $domainList);
        }
    }

    private function showManagedApps(): int
    {
        $this->info('Scanning poly_apps (ncore apps)...');
        $this->newLine();

        if (!is_dir($this->appsDir)) {
            $this->warn("Apps directory not found: {$this->appsDir}");
            return 1;
        }

        $apps = $this->scanApps();

        if (empty($apps)) {
            $this->warn('No applications found');
            return 0;
        }

        $this->info('Found ' . count($apps) . ' applications:');
        $this->newLine();

        foreach ($apps as $app) {
            $this->line("  <fg=cyan>•</> {$app['name']}");
            $this->line("    Type: {$app['type']}");
            $this->line("    Path: {$app['path']}");

            // Show existing service status
            $serviceStatus = $this->getServiceStatus($app['name']);
            if ($serviceStatus) {
                $this->line("    Service: <fg=green>{$serviceStatus}</>");
            }

            $this->newLine();
        }

        return 0;
    }

    private function configureServiceOnly(string $appname): int
    {
        $this->info("Configuring service for: {$appname}");
        $this->info('Mode: Service Only (Idempotent)');
        $this->newLine();

        // Validate app exists
        $appPath = "{$this->appsDir}/{$appname}";
        if (!is_dir($appPath)) {
            $this->error("Application not found: {$appname}");
            $this->line("Expected path: {$appPath}");
            return 1;
        }

        // Detect app type
        $appType = $this->detectAppType($appPath);
        $this->line("Detected type: <fg=cyan>{$appType}</>");

        // Assign port
        $port = $this->option('port') ?: $this->assignPort($appname);
        $this->line("Assigned port: <fg=cyan>{$port}</>");
        $this->newLine();

        // Create or update systemd service (idempotent)
        $serviceName = "ncore-{$appname}";
        $serviceCreated = $this->createOrUpdateService($serviceName, $appname, $appPath, $port);

        if ($serviceCreated) {
            $this->success("✓ Service '{$serviceName}' configured successfully");
            $this->line("  Status: " . $this->getServiceStatus($appname));
            $this->newLine();
            $this->info("To start: systemctl start {$serviceName}");
            $this->info("To view logs: journalctl -u {$serviceName} -f");
            return 0;
        } else {
            $this->error("Failed to configure service");
            return 1;
        }
    }

    private function configureServiceAndProxy(string $appname, array $domains): int
    {
        $this->info("Configuring service and proxy for: {$appname}");
        $this->info('Mode: Service + Reverse Proxy (Idempotent)');
        $this->info('Domains: ' . implode(', ', $domains));
        $this->newLine();

        // Validate app exists
        $appPath = "{$this->appsDir}/{$appname}";
        if (!is_dir($appPath)) {
            $this->error("Application not found: {$appname}");
            $this->line("Expected path: {$appPath}");
            return 1;
        }

        // Detect app type
        $appType = $this->detectAppType($appPath);
        $this->line("Detected type: <fg=cyan>{$appType}</>");

        // Assign port
        $port = $this->option('port') ?: $this->assignPort($appname);
        $this->line("Assigned port: <fg=cyan>{$port}</>");
        $this->newLine();

        // Step 1: Create or update systemd service
        $this->line('<fg=yellow>Step 1/4:</> Creating/Updating systemd service...');
        $serviceName = "ncore-{$appname}";
        $serviceCreated = $this->createOrUpdateService($serviceName, $appname, $appPath, $port);

        if (!$serviceCreated) {
            $this->error('Failed to create service');
            return 1;
        }
        $this->success("✓ Service '{$serviceName}' configured");
        $this->newLine();

        // Step 2: Configure nginx reverse proxy for each domain (idempotent)
        $this->line('<fg=yellow>Step 2/4:</> Configuring nginx reverse proxy...');
        $sslMode = $this->option('ssl');
        $proxyConfigured = 0;

        foreach ($domains as $domain) {
            $this->line("  Configuring: {$domain}");

            if ($this->configureNginxProxy($domain, $port, $sslMode)) {
                $this->success("  ✓ {$domain} configured");
                $proxyConfigured++;
            } else {
                $this->error("  ✗ {$domain} failed");
            }
        }
        $this->newLine();

        // Step 3: Test nginx configuration
        $this->line('<fg=yellow>Step 3/4:</> Testing nginx configuration...');
        $testResult = Process::run('nginx -t 2>&1');
        if (str_contains($testResult->output(), 'successful')) {
            $this->success('✓ Nginx configuration is valid');
        } else {
            $this->error('✗ Nginx configuration test failed');
            $this->line($testResult->output());
            $this->warn('Rolling back may be required');
        }
        $this->newLine();

        // Step 4: Reload nginx (idempotent)
        $this->line('<fg=yellow>Step 4/4:</> Reloading nginx...');
        $reloadResult = Process::run('systemctl reload nginx 2>&1');
        if ($reloadResult->successful()) {
            $this->success('✓ Nginx reloaded successfully');
        } else {
            $this->error('✗ Failed to reload nginx');
            $this->line($reloadResult->errorOutput());
        }
        $this->newLine();

        // Summary
        $this->info('═══ Configuration Summary ═══');
        $this->line("Service: {$serviceName}");
        $this->line("Port: {$port}");
        $this->line("Domains configured: {$proxyConfigured}/" . count($domains));
        $this->newLine();

        foreach ($domains as $domain) {
            $this->line("  • http://{$domain}");
            if ($sslMode !== 'false') {
                $this->line("  • https://{$domain} (if SSL available)");
            }
        }
        $this->newLine();

        $this->info('To start service: systemctl start ' . $serviceName);
        $this->info('To view logs: journalctl -u ' . $serviceName . ' -f');

        return 0;
    }

    private function createOrUpdateService(string $serviceName, string $appname, string $appPath, int $port): bool
    {
        $serviceFile = "/etc/systemd/system/{$serviceName}.service";

        // Generate service content
        $mainJs = "{$this->coreNodeRoot}/main.js";

        $serviceContent = <<<SERVICE
[Unit]
Description=ncore App - {$appname}
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory={$this->coreNodeRoot}
Environment="PORT={$port}"
Environment="NODE_ENV=production"
Environment="APP_NAME={$appname}"
ExecStart=/usr/bin/node {$mainJs} app={$appname}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE;

        // Write service file (idempotent - overwrites if exists)
        $written = @file_put_contents($serviceFile, $serviceContent);
        if ($written === false) {
            $this->error("Failed to write service file: {$serviceFile}");
            return false;
        }

        // Reload systemd daemon
        Process::run('systemctl daemon-reload');

        // Enable service (idempotent)
        Process::run("systemctl enable {$serviceName}");

        return true;
    }

    private function configureNginxProxy(string $domain, int $port, string $sslMode): bool
    {
        // Detect SSL certificate
        $sslEnabled = false;
        $certificate = null;

        if ($sslMode === 'auto' || $sslMode === 'true') {
            $certificate = ServerManagerV1CertificateManager::findCertificateForDomain($domain);
            if ($certificate) {
                $sslEnabled = true;
            }
        }

        // Generate nginx config
        $nginxConfig = $this->generateNginxConfig($domain, $port, $sslEnabled, $certificate);

        // Write config file (idempotent - overwrites if exists)
        $configFile = "/etc/nginx/sites-available/ncore-{$domain}.conf";
        $enabledLink = "/etc/nginx/sites-enabled/ncore-{$domain}.conf";

        $written = @file_put_contents($configFile, $nginxConfig);
        if ($written === false) {
            return false;
        }

        // Create symlink (idempotent)
        if (!file_exists($enabledLink)) {
            @symlink($configFile, $enabledLink);
        }

        // Add domain to database (idempotent)
        try {
            ServerManagerV1DomainManager::addDomain($domain, [
                'type' => 'ncore',
                'www_dir' => $this->appsDir,
                'php_mode' => 'node',
                'port' => $port,
                'app_name' => $this->argument('appname')
            ]);
        } catch (\Exception $e) {
            // Domain might already exist - update it
            $this->line("  (Domain already exists, updating...)");
        }

        return true;
    }

    private function generateNginxConfig(string $domain, int $port, bool $sslEnabled, ?array $certificate): string
    {
        $config = "# Generated by ServerManager - ncore app\n";
        $config .= "# Domain: {$domain}\n";
        $config .= "# Port: {$port}\n\n";

        // HTTP server
        $config .= "server {\n";
        $config .= "    listen 80;\n";
        $config .= "    server_name {$domain} www.{$domain};\n\n";

        if ($sslEnabled) {
            // Redirect to HTTPS
            $config .= "    return 301 https://\$host\$request_uri;\n";
        } else {
            // Serve HTTP
            $config .= $this->getProxyLocationBlock($port);
        }

        $config .= "}\n\n";

        // HTTPS server (if SSL enabled)
        if ($sslEnabled && $certificate) {
            $config .= "server {\n";
            $config .= "    listen 443 ssl http2;\n";
            $config .= "    server_name {$domain} www.{$domain};\n\n";
            $config .= "    ssl_certificate {$certificate['cert_path']};\n";
            $config .= "    ssl_certificate_key {$certificate['key_path']};\n";
            $config .= "    ssl_protocols TLSv1.2 TLSv1.3;\n";
            $config .= "    ssl_ciphers HIGH:!aNULL:!MD5;\n\n";
            $config .= $this->getProxyLocationBlock($port);
            $config .= "}\n";
        }

        return $config;
    }

    private function getProxyLocationBlock(int $port): string
    {
        return <<<LOCATION
    location / {
        proxy_pass http://127.0.0.1:{$port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

LOCATION;
    }

    private function assignPort(string $appname): int
    {
        // Hash-based port assignment for consistency
        $hash = crc32($appname);
        $offset = abs($hash) % 1000;
        return $this->basePort + $offset;
    }

    private function getServiceStatus(string $appname): ?string
    {
        $serviceName = "ncore-{$appname}";
        $result = Process::run("systemctl is-active {$serviceName} 2>/dev/null");

        if ($result->successful()) {
            return trim($result->output());
        }

        return null;
    }

    private function scanApps(): array
    {
        $apps = [];
        $dirs = scandir($this->appsDir);

        foreach ($dirs as $dir) {
            if ($dir === '.' || $dir === '..') {
                continue;
            }

            $fullPath = "{$this->appsDir}/{$dir}";
            if (is_dir($fullPath)) {
                $type = $this->detectAppType($fullPath);

                // For apps in /apps directory without package.json, default to ncore
                if ($type === 'Unknown' && !file_exists("{$fullPath}/package.json")) {
                    // Check if it has typical ncore entry points
                    if (file_exists("{$fullPath}/main.js") ||
                        file_exists("{$fullPath}/main.cmd") ||
                        is_dir("{$fullPath}/config") ||
                        is_dir("{$fullPath}/provider")) {
                        $type = 'ncore App';
                    }
                }

                $apps[] = [
                    'name' => $dir,
                    'path' => $fullPath,
                    'type' => $type
                ];
            }
        }

        return $apps;
    }

    private function detectAppType(string $path): string
    {
        // Priority order matches unified_config.ini

        // Check React Native first (before React)
        if ($this->matchesPattern($path, ['package.json', 'android', 'ios'])) {
            $packageJson = $this->readPackageJson($path);
            if ($packageJson && strpos($packageJson, 'react-native') !== false) {
                return 'React Native';
            }
        }

        // Check Nuxt (before Vue/React)
        if ($this->matchesPattern($path, ['nuxt.config.ts']) || $this->matchesPattern($path, ['nuxt.config.js'])) {
            return 'Nuxt.js';
        }

        // Check React (exclude React Native and Nuxt)
        if (file_exists("{$path}/package.json")) {
            $packageJson = $this->readPackageJson($path);
            if ($packageJson &&
                strpos($packageJson, '"react"') !== false &&
                strpos($packageJson, 'react-native') === false &&
                strpos($packageJson, 'nuxt') === false) {
                return 'React';
            }
        }

        // Check Vue (exclude Nuxt)
        if (file_exists("{$path}/package.json") || file_exists("{$path}/vite.config.js")) {
            $packageJson = $this->readPackageJson($path);
            if ($packageJson &&
                strpos($packageJson, '"vue"') !== false &&
                strpos($packageJson, 'nuxt') === false) {
                return 'Vue';
            }
        }

        // Check Laravel
        if ($this->matchesPattern($path, ['composer.json', 'artisan']) &&
            file_exists("{$path}/public/index.php")) {
            return 'Laravel';
        }

        // Check Flutter
        if ($this->matchesPattern($path, ['pubspec.yaml'])) {
            return 'Flutter';
        }

        // Check Kotlin
        if ($this->matchesPattern($path, ['build.gradle']) || $this->matchesPattern($path, ['build.gradle.kts'])) {
            return 'Kotlin';
        }

        // Check PHP
        if (file_exists("{$path}/composer.json")) {
            return 'PHP';
        }

        // Check Python
        if (file_exists("{$path}/main.py") ||
            file_exists("{$path}/requirements.txt") ||
            file_exists("{$path}/setup.py")) {
            return 'Python';
        }

        // Check Go
        if (file_exists("{$path}/go.mod")) {
            return 'Go';
        }

        // Generic Node.js
        if (file_exists("{$path}/package.json")) {
            return 'Node.js';
        }

        return 'Unknown';
    }

    private function matchesPattern(string $path, array $patterns): bool
    {
        foreach ($patterns as $pattern) {
            if (!file_exists("{$path}/{$pattern}")) {
                return false;
            }
        }
        return true;
    }

    private function readPackageJson(string $path): ?string
    {
        $packageJsonPath = "{$path}/package.json";
        if (file_exists($packageJsonPath)) {
            return file_get_contents($packageJsonPath);
        }
        return null;
    }

    private function showHelp(): int
    {
        $this->info('Poly Apps Manager - Configure ncore applications');
        $this->newLine();

        $this->line('<fg=cyan>Usage Examples:</>');
        $this->line('');
        $this->line('  # List all applications');
        $this->line('  <fg=green>php artisan servermanager:poly_apps --show-apps</>');
        $this->line('');
        $this->line('  # Configure service only (idempotent)');
        $this->line('  <fg=green>php artisan servermanager:poly_apps myapp</>');
        $this->line('');
        $this->line('  # Configure service + reverse proxy (idempotent)');
        $this->line('  <fg=green>php artisan servermanager:poly_apps myapp example.com</>');
        $this->line('');
        $this->line('  # Multiple domains');
        $this->line('  <fg=green>php artisan servermanager:poly_apps myapp "example.com,app.example.com"</>');
        $this->line('');
        $this->line('  # Custom port and SSL');
        $this->line('  <fg=green>php artisan servermanager:poly_apps myapp example.com --port=10001 --ssl=auto</>');
        $this->line('');
        $this->line('<fg=cyan>Features:</>');
        $this->line('  ✓ Idempotent - Safe to run multiple times');
        $this->line('  ✓ Auto port assignment (hash-based)');
        $this->line('  ✓ SSL auto-detection');
        $this->line('  ✓ systemd service management');
        $this->line('  ✓ Nginx reverse proxy configuration');
        $this->line('  ✓ Domain database integration');

        return 0;
    }
}
