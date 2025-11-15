<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands;

use Illuminate\Console\Command;
use App\Apps\ServerManagerV1\ServerManagerV1Gvar\ServerManagerV1Constants;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1Utils;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1SSLConfigReader;
use Illuminate\Support\Facades\Log;

abstract class ServerManagerV1BaseCommand extends Command
{
    /**
     * Execute system command with proper logging
     */
    protected function executeCommand(string $command, array $arguments = [], int $timeout = null): array
    {
        $this->info("Executing: $command " . implode(' ', $arguments));
        
        $result = ServerManagerV1Utils::executeCommand($command, $arguments, $timeout);
        
        if ($result['success']) {
            $this->info("Command executed successfully");
            if (!empty($result['output'])) {
                $this->line($result['output']);
            }
        } else {
            $this->error("Command failed with exit code: " . $result['exit_code']);
            if (!empty($result['error'])) {
                $this->error($result['error']);
            }
        }
        
        return $result;
    }
    
    /**
     * Check if domain is valid
     */
    protected function validateDomain(string $domain): bool
    {
        // Trim whitespace and convert to lowercase
        $domain = strtolower(trim($domain));

        // Must contain at least one dot
        if (strpos($domain, '.') === false) {
            $this->error("Invalid domain name: $domain (must contain at least one dot)");
            return false;
        }

        // Only allow letters, numbers, dots, and hyphens
        if (!preg_match('/^[a-z0-9.-]+$/', $domain)) {
            $this->error("Invalid domain name: $domain (contains invalid characters)");
            return false;
        }

        // No consecutive dots
        if (strpos($domain, '..') !== false) {
            $this->error("Domain name contains consecutive dots: $domain");
            return false;
        }

        // No leading or trailing dots or hyphens
        if (preg_match('/^[.-]|[.-]$/', $domain)) {
            $this->error("Domain name cannot start or end with dot or hyphen: $domain");
            return false;
        }

        // Length check
        if (strlen($domain) > 253) {
            $this->error("Domain name too long: $domain");
            return false;
        }

        return true;
    }
    
    /**
     * Check if nginx configuration exists
     */
    protected function nginxConfigExists(string $domain): bool
    {
        $nginxPaths = \App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1SSLConfigReader::getNginxPaths();
        $configPath = $nginxPaths['config_path'] . "/$domain";
        return file_exists($configPath);
    }

    /**
     * Check if nginx configuration is enabled
     */
    protected function nginxConfigEnabled(string $domain): bool
    {
        $nginxPaths = \App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1SSLConfigReader::getNginxPaths();
        $enabledPath = $nginxPaths['enabled_path'] . "/$domain";
        return file_exists($enabledPath);
    }
    
    /**
     * Create nginx configuration from template
     */
    protected function createNginxConfig(string $domain, string $template, array $variables): bool
    {
        $templatePath = app_path("Apps/ServerManagerV1/ServerManagerV1CLI/Templates/$template.nginx");
        
        if (!file_exists($templatePath)) {
            $this->error("Template not found: $template");
            return false;
        }
        
        $content = file_get_contents($templatePath);
        
        // Replace variables in template
        foreach ($variables as $key => $value) {
            $content = str_replace("{{$key}}", $value, $content);
        }
        
        $nginxPaths = \App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1SSLConfigReader::getNginxPaths();
        $configPath = $nginxPaths['config_path'] . "/$domain";

        if (file_put_contents($configPath, $content) === false) {
            $this->error("Failed to write nginx configuration: $configPath");
            return false;
        }
        
        $this->info("Created nginx configuration: $configPath");
        return true;
    }
    
    /**
     * Enable nginx site
     */
    protected function enableNginxSite(string $domain): bool
    {
        $nginxPaths = \App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1SSLConfigReader::getNginxPaths();
        $availablePath = $nginxPaths['config_path'] . "/$domain";
        $enabledPath = $nginxPaths['enabled_path'] . "/$domain";

        if (!file_exists($availablePath)) {
            $this->error("Configuration not found: $availablePath");
            return false;
        }

        if (file_exists($enabledPath)) {
            $this->info("Site already enabled: $domain");
            return true;
        }

        if (symlink($availablePath, $enabledPath)) {
            $this->info("Enabled nginx site: $domain");
            return true;
        } else {
            $this->error("Failed to enable nginx site: $domain");
            return false;
        }
    }
    
    /**
     * Test nginx configuration
     */
    protected function testNginxConfig(): bool
    {
        $this->info("Testing nginx configuration...");
        $result = $this->executeCommand('nginx', ['-t']);
        return $result['success'];
    }
    
    /**
     * Reload nginx
     */
    protected function reloadNginx(): bool
    {
        $this->info("Reloading nginx...");
        $result = $this->executeCommand('systemctl', ['reload', 'nginx']);
        return $result['success'];
    }
    
    /**
     * Generate SSL certificate using configuration from file
     */
    protected function generateSSLCertificate(string $domain): bool
    {
        try {
            // Load SSL configuration
            $provider = ServerManagerV1SSLConfigReader::getDefaultProvider();
            $email = ServerManagerV1SSLConfigReader::getDefaultEmail();
            $staging = ServerManagerV1SSLConfigReader::isStagingMode();

            $this->info("Generating SSL certificate for: $domain");
            $this->info("Provider: $provider");
            $this->info("Email: $email");

            if ($staging) {
                $this->warn("Using staging environment - certificate will not be trusted!");
            }

            // Check if domain is allowed
            if (!ServerManagerV1SSLConfigReader::isDomainAllowed($domain)) {
                $this->error("Domain $domain is not allowed by security configuration");
                return false;
            }

            $success = match($provider) {
                'letsencrypt' => $this->generateLetsEncryptCertificate($domain, $email, $staging),
                'dnspod' => $this->generateDNSPodCertificate($domain),
                'cloudflare' => $this->generateCloudflareCertificate($domain),
                default => throw new \Exception("Unsupported SSL provider: $provider")
            };

            if ($success) {
                $this->info("SSL certificate generated successfully");
                return true;
            } else {
                $this->error("Failed to generate SSL certificate");
                return false;
            }

        } catch (\Exception $e) {
            $this->error("SSL configuration error: " . $e->getMessage());
            if (strpos($e->getMessage(), 'dd.sh') !== false) {
                $this->warn("Please run: bash /www/wwwroot/core_node/scripts/dd.sh");
            }
            return false;
        }
    }
    
    /**
     * Check if SSL certificate exists
     */
    protected function sslCertificateExists(string $domain): bool
    {
        $certPath = "/etc/letsencrypt/live/$domain/fullchain.pem";
        return file_exists($certPath);
    }
    
    /**
     * Create web directory
     */
    protected function createWebDirectory(string $path): bool
    {
        if (is_dir($path)) {
            $this->info("Directory already exists: $path");
            return true;
        }
        
        if (mkdir($path, 0755, true)) {
            $this->info("Created directory: $path");
            return true;
        } else {
            $this->error("Failed to create directory: $path");
            return false;
        }
    }
    
    /**
     * Get application registry
     */
    protected function getApplicationRegistry(): array
    {
        $registryPath = ServerManagerV1Constants::UNIFIED_MANAGER_SCRIPTS['app_registry'];
        
        if (!file_exists($registryPath)) {
            $this->error("Application registry not found: $registryPath");
            return [];
        }
        
        $content = file_get_contents($registryPath);
        $registry = json_decode($content, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            $this->error("Invalid JSON in application registry");
            return [];
        }
        
        return $registry;
    }
    
    /**
     * Check if application exists in registry
     */
    protected function applicationExists(string $appName): bool
    {
        $registry = $this->getApplicationRegistry();
        return isset($registry['apps'][$appName]);
    }
    
    /**
     * Get application information
     */
    protected function getApplicationInfo(string $appName): ?array
    {
        $registry = $this->getApplicationRegistry();
        return $registry['apps'][$appName] ?? null;
    }
    
    /**
     * Deploy poly application
     */
    protected function deployPolyApplication(string $appName): bool
    {
        $appInfo = $this->getApplicationInfo($appName);
        
        if (!$appInfo) {
            $this->error("Application not found: $appName");
            return false;
        }
        
        $appPath = $appInfo['path'];
        $deployScript = "$appPath/scripts/deploy.sh";
        
        if (!file_exists($deployScript)) {
            $this->error("Deploy script not found: $deployScript");
            return false;
        }
        
        $this->info("Deploying poly application: $appName");
        $result = $this->executeCommand('bash', [$deployScript]);
        
        return $result['success'];
    }
    
    /**
     * Deploy ncore application
     */
    protected function deployNcoreApplication(string $appName): bool
    {
        $this->info("Deploying ncore application: $appName");
        
        $deployScript = ServerManagerV1Constants::UNIFIED_MANAGER_SCRIPTS['deploy_apps'];
        $result = $this->executeCommand('bash', [$deployScript, '--apps', $appName]);
        
        return $result['success'];
    }
    
    /**
     * Detect application port
     */
    protected function detectApplicationPort(string $appName): ?int
    {
        // Try to detect port from running services
        $result = $this->executeCommand('systemctl', ['status', "ncore-$appName"]);
        
        if ($result['success']) {
            // Parse output to find port
            if (preg_match('/localhost:(\d+)/', $result['output'], $matches)) {
                return (int)$matches[1];
            }
        }
        
        // Default ports for common applications
        $defaultPorts = [
            'laravel_main' => 8000,
            'nuxt_main' => 3000,
            'DevOps' => 8080
        ];
        
        return $defaultPorts[$appName] ?? null;
    }
    
    /**
     * Show deployment summary
     */
    protected function showDeploymentSummary(string $domain, string $type, array $details = []): void
    {
        $this->info("=== Deployment Summary ===");
        $this->info("Domain: $domain");
        $this->info("Type: $type");
        
        foreach ($details as $key => $value) {
            $this->info("$key: $value");
        }
        
        $this->info("Nginx Config: /etc/nginx/sites-available/$domain");
        
        if ($this->sslCertificateExists($domain)) {
            $this->info("SSL Certificate: /etc/letsencrypt/live/$domain/");
        }
        
        $this->info("=== Deployment Complete ===");
    }

    /**
     * Generate Let's Encrypt certificate
     */
    protected function generateLetsEncryptCertificate(string $domain, string $email, bool $staging = false): bool
    {
        // Check if certbot is installed
        $checkResult = $this->executeCommand('which', ['certbot']);
        if (!$checkResult['success']) {
            $this->error("Certbot is not installed on this system.");
            $this->warn("To install certbot, run the following command:");
            $this->info("  bash /www/wwwroot/core_node/scripts/shells/linux/debian/install_shells/26_install_certbot.sh");
            $this->warn("Or install manually:");
            $this->info("  sudo apt update && sudo apt install -y certbot python3-certbot-nginx");
            return false;
        }

        // Ensure web directory exists for webroot challenge
        $webroot = ServerManagerV1SSLConfigReader::getDefaultWebRoot() . "/$domain";
        if (!is_dir($webroot)) {
            $webroot = '/var/www/html';
        }

        $args = [
            'certonly',
            '--webroot',
            '-w', $webroot,
            '-d', $domain,
            '--email', $email,
            '--agree-tos',
            '--non-interactive'
        ];

        if ($staging) {
            $args[] = '--staging';
        }

        $result = $this->executeCommand('certbot', $args);
        return $result['success'];
    }

    /**
     * Generate DNSPod certificate
     */
    protected function generateDNSPodCertificate(string $domain): bool
    {
        try {
            $config = ServerManagerV1SSLConfigReader::getProviderConfig('dnspod');

            // Create DNSPod credentials file
            $credentialsPath = '/tmp/dnspod-credentials.ini';
            $credentialsContent = "dns_dnspod_api_id = {$config['api_id']}\n";
            $credentialsContent .= "dns_dnspod_api_token = {$config['api_token']}\n";

            if (file_put_contents($credentialsPath, $credentialsContent) === false) {
                $this->error("Failed to create DNSPod credentials file");
                return false;
            }

            chmod($credentialsPath, 0600);

            $args = [
                'certonly',
                '--dns-dnspod',
                '--dns-dnspod-credentials', $credentialsPath,
                '-d', $domain,
                '--email', ServerManagerV1SSLConfigReader::getDefaultEmail(),
                '--agree-tos',
                '--non-interactive'
            ];

            if (ServerManagerV1SSLConfigReader::isStagingMode()) {
                $args[] = '--staging';
            }

            $result = $this->executeCommand('certbot', $args);

            // Clean up credentials file
            unlink($credentialsPath);

            return $result['success'];

        } catch (\Exception $e) {
            $this->error("DNSPod certificate generation failed: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Generate Cloudflare certificate
     */
    protected function generateCloudflareCertificate(string $domain): bool
    {
        try {
            $config = ServerManagerV1SSLConfigReader::getProviderConfig('cloudflare');

            // Create Cloudflare credentials file
            $credentialsPath = '/tmp/cloudflare-credentials.ini';
            $credentialsContent = "dns_cloudflare_api_token = {$config['api_token']}\n";

            if (file_put_contents($credentialsPath, $credentialsContent) === false) {
                $this->error("Failed to create Cloudflare credentials file");
                return false;
            }

            chmod($credentialsPath, 0600);

            $args = [
                'certonly',
                '--dns-cloudflare',
                '--dns-cloudflare-credentials', $credentialsPath,
                '-d', $domain,
                '--email', ServerManagerV1SSLConfigReader::getDefaultEmail(),
                '--agree-tos',
                '--non-interactive'
            ];

            if (ServerManagerV1SSLConfigReader::isStagingMode()) {
                $args[] = '--staging';
            }

            $result = $this->executeCommand('certbot', $args);

            // Clean up credentials file
            unlink($credentialsPath);

            return $result['success'];

        } catch (\Exception $e) {
            $this->error("Cloudflare certificate generation failed: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Load and validate SSL configuration
     */
    protected function validateSSLConfiguration(): bool
    {
        try {
            $errors = ServerManagerV1SSLConfigReader::validateConfig();

            if (!empty($errors)) {
                $this->error("SSL configuration validation failed:");
                foreach ($errors as $error) {
                    $this->error("  - $error");
                }
                return false;
            }

            return true;

        } catch (\Exception $e) {
            $this->error("SSL configuration error: " . $e->getMessage());
            if (strpos($e->getMessage(), 'dd.sh') !== false) {
                $this->warn("Please run: bash /www/wwwroot/core_node/scripts/dd.sh");
            }
            return false;
        }
    }
}
