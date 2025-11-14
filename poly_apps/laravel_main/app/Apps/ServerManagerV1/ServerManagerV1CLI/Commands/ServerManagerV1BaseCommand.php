<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands;

use Illuminate\Console\Command;
use App\Apps\ServerManagerV1\ServerManagerV1Gvar\ServerManagerV1Constants;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1Utils;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1SSLConfigReader;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1PHPConfigFixer;
use App\Providers\PathMapper;
use Illuminate\Support\Facades\Log;

abstract class ServerManagerV1BaseCommand extends Command
{
    /**
     * Initialize command - called before handle()
     * 
     * This method ensures PHP configuration is correct before any ServerManagerV1
     * operations. It calls ServerManagerV1PHPConfigFixer to fix open_basedir
     * restrictions that might prevent Laravel files from being accessed.
     * 
     * This is a PRE-REQUISITE that matches the behavior of 32_configure_php84.sh
     * but runs at runtime instead of installation time.
     * 
     * See: ../../../../../../scripts/shells/linux/debian/install_shells/32_configure_php84.sh
     */
    protected function initializeCommand(): void
    {
        // Fix PHP configuration before any operations
        // This ensures open_basedir restrictions are removed/configured correctly
        // based on current path mapping (matches 32_configure_php84.sh behavior)
        $this->info('Ensuring PHP configuration is correct...');
        
        $fixed = ServerManagerV1PHPConfigFixer::fixPHPConfiguration();
        
        if ($fixed) {
            $this->info('PHP configuration verified and fixed if needed.');
        } else {
            $this->warn('PHP configuration fix completed with warnings. Some operations may fail.');
            // Use PathMapper to get core_node directory (no hardcoded paths)
            $coreNodeDir = \App\Providers\PathMapper::getCoreNodeDir();
            $scriptPath = $coreNodeDir ? "$coreNodeDir/scripts/shells/linux/debian/install_shells/32_configure_php84.sh" : '';
            if ($scriptPath) {
                $this->warn("You may need to run: sudo bash $scriptPath");
            }
        }
    }
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
                $coreNodePath = \App\Providers\PathMapper::getCoreNodeDir();
                if ($coreNodePath) {
                    $this->warn("Please run: bash $coreNodePath/scripts/dd.sh");
                }
            }
            return false;
        }
    }
    
    /**
     * Check if SSL certificate exists
     */
    protected function sslCertificateExists(string $domain): bool
    {
        $certPath = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getLetsEncryptCertPath($domain);
        return file_exists($certPath);
    }

    /**
     * Check if certificate is expired or expiring soon
     *
     * @param string $domain The domain name
     * @param int $daysBeforeExpiry Days before expiry to consider as "expiring soon" (default: 30)
     * @return array ['exists' => bool, 'expired' => bool, 'expiring_soon' => bool, 'days_until_expiry' => int|null, 'expiry_date' => string|null]
     */
    protected function checkCertificateExpiry(string $domain, int $daysBeforeExpiry = 30): array
    {
        $certPath = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getLetsEncryptCertPath($domain);
        
        $result = [
            'exists' => false,
            'expired' => false,
            'expiring_soon' => false,
            'days_until_expiry' => null,
            'expiry_date' => null
        ];

        if (!file_exists($certPath)) {
            return $result;
        }

        $result['exists'] = true;

        // Get certificate expiry date using openssl
        $opensslResult = $this->executeCommand('openssl', [
            'x509', '-in', $certPath, '-noout', '-enddate'
        ]);

        if (!$opensslResult['success']) {
            return $result;
        }

        // Parse expiry date from openssl output: "notAfter=Apr 15 12:00:00 2025 GMT"
        if (preg_match('/notAfter=(.+)/', $opensslResult['output'], $matches)) {
            $expiryDateStr = trim($matches[1]);
            $expiryTimestamp = strtotime($expiryDateStr);
            $now = time();
            $daysUntilExpiry = (int)ceil(($expiryTimestamp - $now) / 86400);

            $result['expiry_date'] = $expiryDateStr;
            $result['days_until_expiry'] = $daysUntilExpiry;
            $result['expired'] = $daysUntilExpiry < 0;
            $result['expiring_soon'] = $daysUntilExpiry >= 0 && $daysUntilExpiry <= $daysBeforeExpiry;
        }

        return $result;
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
        $registryPath = ServerManagerV1Constants::getUnifiedManagerScripts()['app_registry'];
        
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
        
        $deployScript = ServerManagerV1Constants::getUnifiedManagerScripts()['deploy_apps'];
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
        
        // Use PathMapper for environment-aware path (no hardcoded paths)
        $nginxSitesAvailable = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getNginxSitesAvailable();
        $this->info("Nginx Config: $nginxSitesAvailable/$domain");
        
        if ($this->sslCertificateExists($domain)) {
            $certPath = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getLetsEncryptLiveDir($domain);
            $this->info("SSL Certificate: $certPath/");
            
            // Check certificate expiry
            $expiryInfo = $this->checkCertificateExpiry($domain);
            if ($expiryInfo['exists']) {
                if ($expiryInfo['expired']) {
                    $this->warn("Certificate is EXPIRED!");
                } elseif ($expiryInfo['expiring_soon']) {
                    $this->warn("Certificate expires in {$expiryInfo['days_until_expiry']} days");
                } else {
                    $this->info("Certificate valid for {$expiryInfo['days_until_expiry']} more days");
                }
            }
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
            $coreNodePath = \App\Providers\PathMapper::getCoreNodeDir();
            if ($coreNodePath) {
                $this->info("  bash $coreNodePath/scripts/shells/linux/debian/install_shells/26_install_certbot.sh");
            }
            $this->warn("Or install manually:");
            $this->info("  sudo apt update && sudo apt install -y certbot python3-certbot-nginx");
            return false;
        }

        // Ensure web directory exists for webroot challenge
        // Use PathMapper for environment-aware path (no hardcoded paths)
        $wwwroot = ServerManagerV1SSLConfigReader::getDefaultWebRoot();
        $webroot = "$wwwroot/$domain";
        if (!is_dir($webroot)) {
            // Fallback to default webroot using PathMapper
            $webroot = \App\Providers\PathMapper::mapWebPath('wwwroot');
        }

        // Get custom certificate directory
        $letsEncryptDir = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getLetsEncryptDir();
        $configDir = $letsEncryptDir;
        $workDir = $letsEncryptDir . '/work';
        $logsDir = $letsEncryptDir . '/logs';

        // Ensure directories exist
        if (!is_dir($configDir)) {
            mkdir($configDir, 0755, true);
        }
        if (!is_dir($workDir)) {
            mkdir($workDir, 0755, true);
        }
        if (!is_dir($logsDir)) {
            mkdir($logsDir, 0755, true);
        }

        $args = [
            'certonly',
            '--config-dir', $configDir,
            '--work-dir', $workDir,
            '--logs-dir', $logsDir,
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
            // Get DNSPod credentials from secret storage (same as getDNSCredentials)
            $email = \App\Helpers\GlobalSecretReader::getSecretContent('DNS_DNSPOD_EMAILS');
            $apiToken = \App\Helpers\GlobalSecretReader::getSecretContent('DNS_DNSPOD_API_TOKENS');

            if (!$email || !$apiToken) {
                $this->error("Failed to get DNSPod credentials from secret storage");
                return false;
            }

            // Parse DNSPod API token format: "id,token"
            $tokenParts = explode(',', $apiToken, 2);
            if (count($tokenParts) !== 2) {
                $this->error("Invalid DNSPod API token format. Expected: 'id,token'");
                return false;
            }

            $apiId = trim($tokenParts[0]);
            $apiTokenValue = trim($tokenParts[1]);

            // Create DNSPod credentials file
            // Standard dns-dnspod plugin requires email and api-token (full "id,token" format)
            // certbot automatically prefixes with "dns_dnspod_" for the credentials file
            // Use quotes to prevent configobj from parsing comma-separated value as a list
            $credentialsPath = PathMapper::getLaravelTmpDir() . '/dnspod-credentials.ini';
            $apiToken = $apiId . ',' . $apiTokenValue;
            $credentialsContent = "dns_dnspod_email = {$email}\n";
            $credentialsContent .= "dns_dnspod_api_token = \"{$apiToken}\"\n";

            if (file_put_contents($credentialsPath, $credentialsContent) === false) {
                $this->error("Failed to create DNSPod credentials file");
                return false;
            }

            chmod($credentialsPath, 0600);

            // Get custom certificate directory
            $letsEncryptDir = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getLetsEncryptDir();
            $configDir = $letsEncryptDir;
            $workDir = $letsEncryptDir . '/work';
            $logsDir = $letsEncryptDir . '/logs';

            // Ensure directories exist
            if (!is_dir($configDir)) {
                mkdir($configDir, 0755, true);
            }
            if (!is_dir($workDir)) {
                mkdir($workDir, 0755, true);
            }
            if (!is_dir($logsDir)) {
                mkdir($logsDir, 0755, true);
            }

            $args = [
                'certonly',
                '--config-dir', $configDir,
                '--work-dir', $workDir,
                '--logs-dir', $logsDir,
                '--authenticator', 'dns-dnspod',
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
            $credentialsPath = PathMapper::getLaravelTmpDir() . '/cloudflare-credentials.ini';
            $credentialsContent = "dns_cloudflare_api_token = {$config['api_token']}\n";

            if (file_put_contents($credentialsPath, $credentialsContent) === false) {
                $this->error("Failed to create Cloudflare credentials file");
                return false;
            }

            chmod($credentialsPath, 0600);

            $args = [
                'certonly',
                '--authenticator', 'dns-cloudflare',
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
                $coreNodePath = \App\Providers\PathMapper::getCoreNodeDir();
                if ($coreNodePath) {
                    $this->warn("Please run: bash $coreNodePath/scripts/dd.sh");
                }
            }
            return false;
        }
    }
}
