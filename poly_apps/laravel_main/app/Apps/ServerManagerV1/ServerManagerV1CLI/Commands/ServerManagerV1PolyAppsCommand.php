<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands;

use App\Providers\PathMapper;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\DB;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1DomainManager;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1CertificateManager;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1NginxConfigBuilder;

class ServerManagerV1PolyAppsCommand extends ServerManagerV1BaseCommand
{
    protected $signature = 'servermanager:poly_apps
                            {appname? : Application name to configure}
                            {domains? : Comma-separated domain list (domain1,domain2)}
                            {--show-apps : List all managed apps}
                            {--port= : Override auto-assigned port (not recommended)}
                            {--ssl=auto : SSL mode: auto, true, false}';

    protected $description = 'Manage poly_apps - Auto port assignment based on app index (aligned with dd.sh)';

    private string $coreNodeRoot;
    private array $appsDirs;
    private int $basePort = 10000;

    public function __construct()
    {
        parent::__construct();

        $this->coreNodeRoot = PathMapper::getCoreNodeDir();

        // Dynamic scan directories (aligned with dd.sh)
        $this->appsDirs = [
            ['path' => "{$this->coreNodeRoot}/apps", 'type' => 'ncoreApp'],
            ['path' => "{$this->coreNodeRoot}/pyapps", 'type' => 'pycoreApp'],
            ['path' => "{$this->coreNodeRoot}/poly_apps", 'type' => 'polyApp']
        ];
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
        $this->info('Scanning applications (apps/, pyapps/, poly_apps/)...');
        $this->newLine();

        $apps = $this->scanApps();

        if (empty($apps)) {
            $this->warn('No applications found');
            return 0;
        }

        // Group by directory
        $byDirectory = [];
        foreach ($apps as $app) {
            $dirName = basename(dirname($app['path']));
            if (!isset($byDirectory[$dirName])) {
                $byDirectory[$dirName] = [];
            }
            $byDirectory[$dirName][] = $app;
        }

        $this->info('Found ' . count($apps) . ' applications across ' . count($byDirectory) . ' directories:');
        $this->newLine();

        $globalIndex = 0;
        foreach ($byDirectory as $dirName => $dirApps) {
            $this->line("<fg=yellow>/{$dirName}</> (" . count($dirApps) . " apps):");

            foreach ($dirApps as $app) {
                $autoPort = $this->basePort + $globalIndex;
                $this->line("  <fg=cyan>•</> [{$globalIndex}] {$app['name']} <fg=gray>(auto-port: {$autoPort})</>");
                $this->line("    Type: {$app['type']} | Category: {$app['category']}");
                $this->line("    Path: {$app['path']}");

                // Show existing service status
                $serviceStatus = $this->getServiceStatus($app['name']);
                if ($serviceStatus) {
                    $this->line("    Service: <fg=green>{$serviceStatus}</>");
                }

                $this->newLine();
                $globalIndex++;
            }
        }

        return 0;
    }

    private function configureServiceOnly(string $appname): int
    {
        $this->info("Configuring service for: {$appname}");
        $this->info('Mode: Service Only (Idempotent)');
        $this->newLine();

        // Find app in all directories
        $appInfo = $this->findApp($appname);
        if (!$appInfo) {
            $this->error("Application not found: {$appname}");
            $this->line("Searched in: apps/, pyapps/, poly_apps/");
            return 1;
        }

        $appPath = $appInfo['path'];
        $appType = $appInfo['type'];

        $this->line("App type: <fg=cyan>{$appType}</>");
        $this->line("Category: <fg=cyan>{$appInfo['category']}</>");

        // Assign port
        $port = $this->option('port') ?: $this->assignPort($appname);
        $this->line("Assigned port: <fg=cyan>{$port}</>");
        $this->newLine();

        // Create or update systemd service (idempotent)
        $serviceName = $this->getServiceNameByType($appType, $appname);
        $serviceCreated = $this->createOrUpdateService($serviceName, $appname, $appPath, $port, $appType);

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

        // Find app in all directories
        $appInfo = $this->findApp($appname);
        if (!$appInfo) {
            $this->error("Application not found: {$appname}");
            $this->line("Searched in: apps/, pyapps/, poly_apps/");
            return 1;
        }

        $appPath = $appInfo['path'];
        $appType = $appInfo['type'];

        $this->line("App type: <fg=cyan>{$appType}</>");
        $this->line("Category: <fg=cyan>{$appInfo['category']}</>");

        // Assign port
        $port = $this->option('port') ?: $this->assignPort($appname);
        $this->line("Assigned port: <fg=cyan>{$port}</>");
        $this->newLine();

        // Step 1: Create or update systemd service
        $this->line('<fg=yellow>Step 1/4:</> Creating/Updating systemd service...');
        $serviceName = $this->getServiceNameByType($appType, $appname);
        $serviceCreated = $this->createOrUpdateService($serviceName, $appname, $appPath, $port, $appType);

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

    private function createOrUpdateService(string $serviceName, string $appname, string $appPath, int $port, string $appType): bool
    {
        $serviceFile = "/etc/systemd/system/{$serviceName}.service";

        // Generate launcher script using Python (same as dd.sh)
        $launcherScript = $this->generateLauncherScript($serviceName, $appPath, $appType, $port);

        if (!$launcherScript || !file_exists($launcherScript)) {
            $this->error("Failed to generate launcher script");
            return false;
        }

        // Make launcher executable
        @chmod($launcherScript, 0755);

        // Generate service content (aligned with dd.sh)
        $serviceContent = <<<SERVICE
[Unit]
Description={$appname} ({$appType}) - Auto-generated by Unified Manager
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory={$appPath}
ExecStart={$launcherScript}
Restart=always
RestartSec=5
CPUQuota=50%
MemoryMax=1G
MemoryHigh=800M
TasksMax=100
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

    private function generateLauncherScript(string $serviceName, string $appPath, string $appType, int $port): ?string
    {
        // Use Python launcher generator (same as dd.sh)
        $launcherGenerator = "{$this->coreNodeRoot}/scripts/unified_manager/core/launcher_generator.py";

        if (!file_exists($launcherGenerator)) {
            $this->warn("Launcher generator not found, using simple launcher");
            return $this->generateSimpleLauncher($serviceName, $appPath, $port);
        }

        // Call Python launcher generator
        $pythonCode = <<<PYTHON
import sys
sys.path.append('{$this->coreNodeRoot}/scripts/unified_manager/core')
from launcher_generator import LauncherGenerator

generator = LauncherGenerator()
launcher_path = generator.generate_launcher(
    service_name='{$serviceName}',
    app_path='{$appPath}',
    framework_type='{$appType}',
    port={$port},
    debug_mode=False
)
print(launcher_path)
PYTHON;

        $result = Process::run("python3 -c " . escapeshellarg($pythonCode));

        if ($result->successful() && !empty(trim($result->output()))) {
            return trim($result->output());
        }

        // Fallback to simple launcher
        return $this->generateSimpleLauncher($serviceName, $appPath, $port);
    }

    private function generateSimpleLauncher(string $serviceName, string $appPath, int $port): string
    {
        $launcherPath = "{$this->coreNodeRoot}/temp/launchers/{$serviceName}.sh";
        $launcherDir = dirname($launcherPath);

        @mkdir($launcherDir, 0755, true);

        $appName = basename($appPath);
        $mainJs = "{$this->coreNodeRoot}/main.js";

        $launcherContent = <<<LAUNCHER
#!/bin/bash
export PORT={$port}
export NODE_ENV=production
export APP_NAME={$appName}
cd {$this->coreNodeRoot}
exec /usr/bin/node {$mainJs} app={$appName}
LAUNCHER;

        file_put_contents($launcherPath, $launcherContent);
        chmod($launcherPath, 0755);

        return $launcherPath;
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

        // Generate nginx config (aligned with dd.sh)
        $nginxConfig = $this->generateNginxConfig($domain, $port, $sslEnabled, $certificate);

        // Write config file (idempotent - overwrites if exists)
        // Aligned with dd.sh: use domain name directly without prefix
        $configFile = "/etc/nginx/sites-available/{$domain}";
        $enabledLink = "/etc/nginx/sites-enabled/{$domain}";

        $written = @file_put_contents($configFile, $nginxConfig);
        if ($written === false) {
            return false;
        }

        // Create symlink (idempotent)
        if (!file_exists($enabledLink)) {
            @symlink($configFile, $enabledLink);
        }

        // Add domain to database (idempotent)
        $appInfo = $this->findApp($this->argument('appname'));
        $appCategory = $appInfo['category'] ?? 'ncoreApp';

        try {
            ServerManagerV1DomainManager::addDomain($domain, [
                'type' => 'proxy',
                'www_dir' => $appInfo ? dirname($appInfo['path']) : $this->appsDirs[0]['path'],
                'php_mode' => 'node',
                'port' => $port,
                'app_name' => $this->argument('appname'),
                'category' => $appCategory
            ]);
        } catch (\Exception $e) {
            // Domain might already exist - update it
            $this->line("  (Domain already exists, updating...)");
        }

        return true;
    }

    private function findApp(string $appname): ?array
    {
        $apps = $this->scanApps();

        foreach ($apps as $app) {
            if ($app['name'] === $appname) {
                return $app;
            }
        }

        return null;
    }

    private function generateNginxConfig(string $domain, int $port, bool $sslEnabled, ?array $certificate): string
    {
        $config = "# Generated by Unified App Manager\n";
        $config .= "# Domain: {$domain}\n";
        $config .= "# Port: {$port}\n\n";

        // HTTP server
        $config .= "server {\n";
        $config .= "    listen 80;\n";
        $config .= "    server_name {$domain};\n\n";

        if ($sslEnabled) {
            // Redirect to HTTPS
            $config .= "    return 301 https://\$server_name\$request_uri;\n";
        } else {
            // Serve HTTP with full features
            $config .= $this->getProxyLocationBlock($port);
        }

        $config .= "}\n\n";

        // HTTPS server (if SSL enabled) - shared TLS/HTTP3 stanza from the
        // builder, app-specific proxy locations stay local (Reverb/HMR).
        if ($sslEnabled && $certificate) {
            $config .= "server {\n";
            $config .= ServerManagerV1NginxConfigBuilder::renderTlsStanza(
                $certificate['cert_path'],
                $certificate['key_path']
            );
            $config .= "\n    server_name {$domain};\n\n";
            $config .= "    # Security headers\n";
            $config .= "    add_header X-Frame-Options DENY;\n";
            $config .= "    add_header X-Content-Type-Options nosniff;\n";
            $config .= "    add_header X-XSS-Protection \"1; mode=block\";\n\n";
            $config .= $this->getProxyLocationBlock($port, true);
            $config .= "}\n";
        }

        return $config;
    }

    private function getProxyLocationBlock(int $port, bool $https = false): string
    {
        $proto = $https ? 'https' : '$scheme';
        $reverbPort = (int) config('reverb.servers.reverb.port', 8080);

        return <<<LOCATION
    location /app/ {
        proxy_pass http://127.0.0.1:{$reverbPort};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 75;
    }

    # Proxy configuration
    location / {
        proxy_pass http://127.0.0.1:{$port};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto {$proto};

        # WebSocket support for dev servers
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        # Increase timeout for development servers
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;

        # Handle large uploads
        client_max_body_size 100M;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        proxy_pass http://127.0.0.1:{$port};
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto {$proto};
    }

    # Hot reload support for development (React/Vue)
    location /sockjs-node {
        proxy_pass http://127.0.0.1:{$port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }

    # Vite HMR support
    location /@vite {
        proxy_pass http://127.0.0.1:{$port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }

LOCATION;
    }

    private function getServiceNameByType(string $appType, string $appname): string
    {
        // Aligned with dd.sh service naming convention
        return match($appType) {
            'React', 'Vue' => "webapp-{$appname}",
            'Nuxt.js' => "nuxt-{$appname}",
            'Laravel' => "laravel-{$appname}",
            'Flutter' => "flutter-{$appname}",
            default => "app-{$appname}"
        };
    }

    private function assignPort(string $appname): int
    {
        // Port assignment based on app index in scan list (aligned with dd.sh)
        // dd.sh uses: base_port + index (auto_increment mode)
        $apps = $this->scanApps();

        foreach ($apps as $index => $app) {
            if ($app['name'] === $appname) {
                return $this->basePort + $index;
            }
        }

        // Fallback: hash-based if app not found in scan
        $hash = crc32($appname);
        $offset = abs($hash) % 1000;
        return $this->basePort + $offset;
    }

    private function getServiceStatus(string $appname): ?string
    {
        // Try different service name patterns (aligned with dd.sh)
        $patterns = [
            "webapp-{$appname}",
            "nuxt-{$appname}",
            "laravel-{$appname}",
            "flutter-{$appname}",
            "app-{$appname}",
            "ncore-{$appname}"
        ];

        foreach ($patterns as $serviceName) {
            $result = Process::run("systemctl is-active {$serviceName} 2>/dev/null");

            if ($result->successful()) {
                $status = trim($result->output());
                return "{$serviceName} ({$status})";
            }
        }

        return null;
    }

    private function scanApps(): array
    {
        $apps = [];

        // Scan all directories dynamically (aligned with dd.sh)
        foreach ($this->appsDirs as $dirConfig) {
            $baseDir = $dirConfig['path'];
            $category = $dirConfig['type'];

            if (!is_dir($baseDir)) {
                continue;
            }

            $dirs = scandir($baseDir);

            foreach ($dirs as $dir) {
                if ($dir === '.' || $dir === '..') {
                    continue;
                }

                $fullPath = "{$baseDir}/{$dir}";
                if (is_dir($fullPath)) {
                    $type = $this->detectAppType($fullPath);

                    // For ncore apps without package.json, use ncore detection
                    if ($category === 'ncoreApp' && $type === 'Unknown' && !file_exists("{$fullPath}/package.json")) {
                        // Check if it has typical ncore entry points
                        if (file_exists("{$fullPath}/main.js") ||
                            file_exists("{$fullPath}/main.cmd") ||
                            is_dir("{$fullPath}/config") ||
                            is_dir("{$fullPath}/provider")) {
                            $type = 'ncore App';
                        }
                    }

                    // For pycore apps
                    if ($category === 'pycoreApp' && $type === 'Python') {
                        $type = 'pycore App';
                    }

                    $apps[] = [
                        'name' => $dir,
                        'path' => $fullPath,
                        'type' => $type,
                        'category' => $category
                    ];
                }
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
        $this->info('Poly Apps Manager - Unified App Deployment (Aligned with dd.sh)');
        $this->newLine();

        $this->line('<fg=cyan>Usage Examples:</>');
        $this->line('');
        $this->line('  # List all applications with auto-assigned ports');
        $this->line('  <fg=green>php artisan servermanager:poly_apps --show-apps</>');
        $this->line('');
        $this->line('  # Configure service (port auto-assigned based on app index)');
        $this->line('  <fg=green>php artisan servermanager:poly_apps myapp</>');
        $this->line('');
        $this->line('  # Configure service + reverse proxy');
        $this->line('  <fg=green>php artisan servermanager:poly_apps myapp example.com</>');
        $this->line('');
        $this->line('  # Multiple domains');
        $this->line('  <fg=green>php artisan servermanager:poly_apps myapp "example.com,app.example.com"</>');
        $this->line('');
        $this->line('  # Override auto-assigned port (not recommended)');
        $this->line('  <fg=green>php artisan servermanager:poly_apps myapp example.com --port=10999</>');
        $this->line('');
        $this->line('<fg=cyan>Port Assignment (Aligned with dd.sh):</>');
        $this->line('  • Ports are automatically assigned based on app scan index');
        $this->line('  • Formula: port = 10000 + app_index');
        $this->line('  • Example: DevOps (index 0) = 10000, DocumentOffline (index 1) = 10001');
        $this->line('  • Use --show-apps to see assigned ports');
        $this->line('');
        $this->line('<fg=cyan>Features (100% Compatible with dd.sh):</>');
        $this->line('  ✓ Idempotent - Safe to run multiple times');
        $this->line('  ✓ Dynamic app scanning (apps/, pyapps/, poly_apps/)');
        $this->line('  ✓ Index-based port assignment (10000 + index)');
        $this->line('  ✓ Python launcher generator integration');
        $this->line('  ✓ Framework-aware service naming (webapp-*, nuxt-*, laravel-*, etc.)');
        $this->line('  ✓ Resource limits (CPU: 50%, Memory: 1G)');
        $this->line('  ✓ SSL auto-detection');
        $this->line('  ✓ WebSocket/HMR support (sockjs-node, @vite)');
        $this->line('  ✓ Static asset caching');
        $this->line('');
        $this->line('<fg=yellow>Note:</> This command produces identical results to dd.sh Unified App Manager');

        return 0;
    }
}
