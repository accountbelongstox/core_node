<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands;

use Illuminate\Support\Facades\Log;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1SSLConfigReader;

class ServerManagerV1DeployCommand extends ServerManagerV1BaseCommand
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'servermanager:deploy
                            {domain : The domain name to deploy}
                            {type : Deployment type (laravel|poly-app|ncore-app|static|proxy)}
                            {--app-name= : Application name for poly/ncore apps}
                            {--www-dir= : Custom web directory}
                            {--php-version= : PHP version (default from config)}
                            {--proxy-target= : Proxy target URL}
                            {--no-ssl : Skip SSL certificate generation}
                            {--force : Force update existing configuration}
                            {--dry-run : Show what would be done without executing}';

    /**
     * The console command description.
     */
    protected $description = 'Deploy domain with nginx configuration and SSL certificate';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $domain = $this->argument('domain');
        $type = $this->argument('type');

        // Print environment information
        $this->printEnvironmentInfo();

        // Validate domain
        if (!$this->validateDomain($domain)) {
            return 1;
        }

        // Validate type
        $validTypes = ['laravel', 'poly-app', 'ncore-app', 'static', 'proxy'];
        if (!in_array($type, $validTypes)) {
            $this->error("Invalid deployment type. Valid types: " . implode(', ', $validTypes));
            return 1;
        }

        // Check if configuration exists and handle force option
        if ($this->nginxConfigExists($domain) && !$this->option('force')) {
            $this->error("Configuration already exists for $domain. Use --force to update.");
            return 1;
        }

        // Validate SSL configuration first
        $this->info("=== SSL Configuration Validation ===");
        if (!$this->validateSSLConfiguration()) {
            return 1;
        }

        // Show dry-run information
        if ($this->option('dry-run')) {
            return $this->showDryRun($domain, $type);
        }

        // Log deployment start
        Log::info("ServerManagerV1 CLI: Starting deployment", [
            'domain' => $domain,
            'type' => $type,
            'options' => $this->options()
        ]);

        // Execute deployment based on type
        $success = match($type) {
            'laravel' => $this->deployLaravel($domain),
            'poly-app' => $this->deployPolyApp($domain),
            'ncore-app' => $this->deployNcoreApp($domain),
            'static' => $this->deployStatic($domain),
            'proxy' => $this->deployProxy($domain),
            default => false
        };

        if ($success) {
            $this->info("Deployment completed successfully!");
            return 0;
        } else {
            $this->error("Deployment failed!");
            return 1;
        }
    }

    /**
     * Print environment information
     */
    private function printEnvironmentInfo(): void
    {
        $this->info("=== Environment Information ===");

        try {
            $envInfo = \App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1PathResolver::getEnvironmentInfo();
            $this->line($envInfo);

            $env = \App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1PathResolver::detectEnvironment();

            // Debug paths
            $this->info("\n=== Path Debug Information ===");
            $paths = [
                ['Core Node Root', $env['core_node_path']],
                ['Secret Keys Dir', \App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1PathResolver::getSecretKeysPath()],
                ['DD Script', \App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1PathResolver::getDdScriptPath()],
                ['Web Root', \App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1PathResolver::resolveWebRoot()]
            ];

            foreach ($paths as [$label, $path]) {
                $exists = file_exists($path);
                $status = $exists ? '✓ EXISTS' : '✗ NOT FOUND';
                $color = $exists ? 'info' : 'error';
                $this->$color("$label: $path [$status]");
            }

            // Nginx paths
            $nginxPaths = \App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1PathResolver::getNginxPaths();
            $this->info("\n=== Nginx Configuration ===");
            $this->line("Config Path: {$nginxPaths['config_path']}");
            $this->line("Enabled Path: {$nginxPaths['enabled_path']}");
            $this->line("Available: " . ($nginxPaths['available'] ? 'Yes' : 'No'));
            $this->line("Note: {$nginxPaths['note']}");

        } catch (\Exception $e) {
            $this->error("Failed to load environment info: " . $e->getMessage());
            $this->error("Stack trace: " . $e->getTraceAsString());
        }

        $this->line("");
    }
    
    /**
     * Show dry-run information
     */
    private function showDryRun(string $domain, string $type): int
    {
        $this->info("=== DRY RUN MODE ===");
        $this->info("Domain: $domain");
        $this->info("Type: $type");
        
        $wwwDir = $this->option('www-dir') ?: $domain;
        $wwwDir = ServerManagerV1SSLConfigReader::resolveWebDirectory($wwwDir);
        $this->info("Web Directory: $wwwDir");
        
        $this->info("Actions that would be performed:");
        
        switch ($type) {
            case 'laravel':
                $this->info("1. Create web directory: $wwwDir");
                $this->info("2. Create nginx configuration with PHP-FPM");
                $this->info("3. Enable nginx site");
                $this->info("4. Generate SSL certificate");
                $this->info("5. Reload nginx");
                break;
                
            case 'poly-app':
                $appName = $this->option('app-name');
                $this->info("1. Deploy poly application: $appName");
                $this->info("2. Create nginx configuration");
                $this->info("3. Enable nginx site");
                $this->info("4. Generate SSL certificate");
                $this->info("5. Reload nginx");
                break;
                
            case 'ncore-app':
                $appName = $this->option('app-name');
                $this->info("1. Deploy ncore application: $appName");
                $this->info("2. Detect application port");
                $this->info("3. Create reverse proxy configuration");
                $this->info("4. Enable nginx site");
                $this->info("5. Generate SSL certificate");
                $this->info("6. Reload nginx");
                break;
                
            case 'static':
                $this->info("1. Create web directory: $wwwDir");
                $this->info("2. Create static site nginx configuration");
                $this->info("3. Enable nginx site");
                $this->info("4. Generate SSL certificate");
                $this->info("5. Reload nginx");
                break;
                
            case 'proxy':
                $proxyTarget = $this->option('proxy-target');
                $this->info("1. Create reverse proxy configuration");
                $this->info("2. Proxy target: $proxyTarget");
                $this->info("3. Enable nginx site");
                $this->info("4. Generate SSL certificate");
                $this->info("5. Reload nginx");
                break;
        }
        
        $this->info("=== END DRY RUN ===");
        return 0;
    }
    
    /**
     * Deploy Laravel application
     */
    private function deployLaravel(string $domain): bool
    {
        $this->info("Deploying Laravel application for: $domain");

        $wwwDir = $this->option('www-dir') ?: $domain;
        $wwwDir = ServerManagerV1SSLConfigReader::resolveWebDirectory($wwwDir);
        $phpVersion = $this->option('php-version') ?: ServerManagerV1SSLConfigReader::getDefaultPhpVersion();
        
        // Create web directory
        if (!$this->createWebDirectory($wwwDir)) {
            return false;
        }
        
        // Create nginx configuration
        $variables = [
            'DOMAIN_NAME' => $domain,
            'WWW_DIR' => $wwwDir,
            'PHP_VERSION' => $phpVersion
        ];
        
        if (!$this->createNginxConfig($domain, 'laravel', $variables)) {
            return false;
        }
        
        // Enable site
        if (!$this->enableNginxSite($domain)) {
            return false;
        }
        
        // Generate SSL certificate
        if (!$this->generateSSLIfNeeded($domain)) {
            return false;
        }
        
        // Test and reload nginx
        if (!$this->testNginxConfig()) {
            return false;
        }
        
        if (!$this->reloadNginx()) {
            return false;
        }
        
        $this->showDeploymentSummary($domain, 'Laravel', [
            'Web Directory' => $wwwDir,
            'PHP Version' => $phpVersion
        ]);
        
        return true;
    }
    
    /**
     * Deploy Poly application
     */
    private function deployPolyApp(string $domain): bool
    {
        $appName = $this->option('app-name');
        
        if (!$appName) {
            $this->error("--app-name is required for poly-app deployment");
            return false;
        }
        
        $this->info("Deploying Poly application: $appName for domain: $domain");
        
        // Check if application exists
        if (!$this->applicationExists($appName)) {
            $this->error("Application not found in registry: $appName");
            return false;
        }
        
        // Deploy the application first
        if (!$this->deployPolyApplication($appName)) {
            return false;
        }
        
        // Get application info
        $appInfo = $this->getApplicationInfo($appName);
        $appType = $appInfo['type'] ?? 'unknown';
        
        // Create appropriate nginx configuration
        $template = match($appType) {
            'poly-laravel' => 'laravel',
            'poly-vue' => 'static',
            'poly-flutter' => 'static',
            default => 'laravel'
        };
        
        $wwwDir = $appInfo['path'] ?? "/www/wwwroot/$domain";
        if ($template === 'laravel') {
            $wwwDir .= '/public';
        }
        
        $variables = [
            'DOMAIN_NAME' => $domain,
            'WWW_DIR' => $wwwDir,
            'PHP_VERSION' => $this->option('php-version') ?: '8.2'
        ];
        
        if (!$this->createNginxConfig($domain, $template, $variables)) {
            return false;
        }
        
        // Enable site and SSL
        if (!$this->enableNginxSite($domain)) {
            return false;
        }
        
        if (!$this->generateSSLIfNeeded($domain)) {
            return false;
        }
        
        if (!$this->testNginxConfig() || !$this->reloadNginx()) {
            return false;
        }
        
        $this->showDeploymentSummary($domain, "Poly App ($appType)", [
            'Application' => $appName,
            'Web Directory' => $wwwDir
        ]);
        
        return true;
    }
    
    /**
     * Deploy NCore application
     */
    private function deployNcoreApp(string $domain): bool
    {
        $appName = $this->option('app-name');
        
        if (!$appName) {
            $this->error("--app-name is required for ncore-app deployment");
            return false;
        }
        
        $this->info("Deploying NCore application: $appName for domain: $domain");
        
        // Deploy the application first
        if (!$this->deployNcoreApplication($appName)) {
            return false;
        }
        
        // Detect application port
        $port = $this->detectApplicationPort($appName);
        if (!$port) {
            $this->error("Could not detect application port for: $appName");
            return false;
        }
        
        $this->info("Detected application port: $port");
        
        // Create reverse proxy configuration
        $variables = [
            'DOMAIN_NAME' => $domain,
            'PORT_NUMBER' => $port
        ];
        
        if (!$this->createNginxConfig($domain, 'proxy', $variables)) {
            return false;
        }
        
        // Enable site and SSL
        if (!$this->enableNginxSite($domain)) {
            return false;
        }
        
        if (!$this->generateSSLIfNeeded($domain)) {
            return false;
        }
        
        if (!$this->testNginxConfig() || !$this->reloadNginx()) {
            return false;
        }
        
        $this->showDeploymentSummary($domain, 'NCore App', [
            'Application' => $appName,
            'Proxy Target' => "http://localhost:$port"
        ]);
        
        return true;
    }
    
    /**
     * Deploy static website
     */
    private function deployStatic(string $domain): bool
    {
        $this->info("Deploying static website for: $domain");

        $wwwDir = $this->option('www-dir') ?: $domain;
        $wwwDir = ServerManagerV1SSLConfigReader::resolveWebDirectory($wwwDir);
        
        // Create web directory
        if (!$this->createWebDirectory($wwwDir)) {
            return false;
        }
        
        // Create nginx configuration
        $variables = [
            'DOMAIN_NAME' => $domain,
            'WWW_DIR' => $wwwDir
        ];
        
        if (!$this->createNginxConfig($domain, 'static', $variables)) {
            return false;
        }
        
        // Enable site and SSL
        if (!$this->enableNginxSite($domain)) {
            return false;
        }
        
        if (!$this->generateSSLIfNeeded($domain)) {
            return false;
        }
        
        if (!$this->testNginxConfig() || !$this->reloadNginx()) {
            return false;
        }
        
        $this->showDeploymentSummary($domain, 'Static Website', [
            'Web Directory' => $wwwDir
        ]);
        
        return true;
    }
    
    /**
     * Deploy reverse proxy
     */
    private function deployProxy(string $domain): bool
    {
        $proxyTarget = $this->option('proxy-target');
        
        if (!$proxyTarget) {
            $this->error("--proxy-target is required for proxy deployment");
            return false;
        }
        
        $this->info("Deploying reverse proxy for: $domain -> $proxyTarget");
        
        // Parse proxy target to get port
        if (preg_match('/localhost:(\d+)/', $proxyTarget, $matches)) {
            $port = $matches[1];
        } else {
            $this->error("Invalid proxy target format. Expected: http://localhost:PORT");
            return false;
        }
        
        // Create reverse proxy configuration
        $variables = [
            'DOMAIN_NAME' => $domain,
            'PORT_NUMBER' => $port
        ];
        
        if (!$this->createNginxConfig($domain, 'proxy', $variables)) {
            return false;
        }
        
        // Enable site and SSL
        if (!$this->enableNginxSite($domain)) {
            return false;
        }
        
        if (!$this->generateSSLIfNeeded($domain)) {
            return false;
        }
        
        if (!$this->testNginxConfig() || !$this->reloadNginx()) {
            return false;
        }
        
        $this->showDeploymentSummary($domain, 'Reverse Proxy', [
            'Proxy Target' => $proxyTarget
        ]);
        
        return true;
    }
    
    /**
     * Generate SSL certificate if needed
     */
    private function generateSSLIfNeeded(string $domain): bool
    {
        // Skip SSL if requested
        if ($this->option('no-ssl')) {
            $this->info("Skipping SSL certificate generation (--no-ssl specified)");
            return true;
        }

        // Check if auto SSL is enabled
        if (!ServerManagerV1SSLConfigReader::isAutoSSLEnabled()) {
            $this->info("Auto SSL is disabled in configuration");
            return true;
        }

        if ($this->sslCertificateExists($domain)) {
            $this->info("SSL certificate already exists for: $domain");
            return true;
        }

        return $this->generateSSLCertificate($domain);
    }
}
