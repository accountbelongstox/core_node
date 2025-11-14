<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands;

use Illuminate\Support\Facades\Log;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1SSLConfigReader;

class ServerManagerV1SSLCommand extends ServerManagerV1BaseCommand
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'servermanager:ssl
                            {action : Action to perform (generate|renew|list|status|config)}
                            {domain? : Domain name (required for generate and status)}
                            {--provider= : Override SSL provider from config}
                            {--staging : Override staging mode from config}
                            {--all : Apply to all domains (for renew)}';

    /**
     * The console command description.
     */
    protected $description = 'Manage SSL certificates';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $action = $this->argument('action');
        $domain = $this->argument('domain');
        
        return match($action) {
            'generate' => $this->generateCertificate($domain),
            'renew' => $this->renewCertificates($domain),
            'list' => $this->listCertificates(),
            'status' => $this->showCertificateStatus($domain),
            'config' => $this->showConfiguration(),
            default => $this->showUsage()
        };
    }
    
    /**
     * Generate SSL certificate
     */
    private function generateCertificate(?string $domain): int
    {
        if (!$domain) {
            $this->error("Domain is required for certificate generation");
            return 1;
        }

        if (!$this->validateDomain($domain)) {
            return 1;
        }

        // Validate SSL configuration
        if (!$this->validateSSLConfiguration()) {
            return 1;
        }

        // Check if certificate already exists
        if ($this->sslCertificateExists($domain)) {
            if (!$this->confirm("Certificate already exists for $domain. Overwrite?")) {
                $this->info("Certificate generation cancelled");
                return 0;
            }
        }

        if ($this->generateSSLCertificate($domain)) {
            $this->info("SSL certificate generated successfully for: $domain");
            $this->showCertificateInfo($domain);
            return 0;
        } else {
            $this->error("Failed to generate SSL certificate");
            return 1;
        }
    }
    
    /**
     * Renew certificates
     */
    private function renewCertificates(?string $domain): int
    {
        if ($this->option('all')) {
            $this->info("Renewing all certificates...");
            $result = $this->executeCommand('certbot', ['renew', '--quiet']);
            
            if ($result['success']) {
                $this->info("Certificate renewal completed");
                $this->reloadNginx();
                return 0;
            } else {
                $this->error("Certificate renewal failed");
                return 1;
            }
        }
        
        if (!$domain) {
            $this->error("Domain is required for certificate renewal (or use --all)");
            return 1;
        }
        
        if (!$this->sslCertificateExists($domain)) {
            $this->error("No certificate found for: $domain");
            return 1;
        }
        
        $this->info("Renewing certificate for: $domain");
        $result = $this->executeCommand('certbot', ['renew', '--cert-name', $domain, '--quiet']);
        
        if ($result['success']) {
            $this->info("Certificate renewed successfully");
            $this->reloadNginx();
            return 0;
        } else {
            $this->error("Certificate renewal failed");
            return 1;
        }
    }
    
    /**
     * List all certificates
     */
    private function listCertificates(): int
    {
        $this->info("Listing SSL certificates...");
        
        $result = $this->executeCommand('certbot', ['certificates']);
        
        if ($result['success']) {
            $this->info("Certificate list retrieved successfully");
            return 0;
        } else {
            $this->error("Failed to retrieve certificate list");
            return 1;
        }
    }
    
    /**
     * Show certificate status
     */
    private function showCertificateStatus(?string $domain): int
    {
        if (!$domain) {
            $this->error("Domain is required for certificate status");
            return 1;
        }
        
        if (!$this->sslCertificateExists($domain)) {
            $this->error("No certificate found for: $domain");
            return 1;
        }
        
        $this->showCertificateInfo($domain);
        return 0;
    }
    

    
    /**
     * Show certificate information
     */
    private function showCertificateInfo(string $domain): void
    {
        // Use PathMapper for environment-aware certificate path (no hardcoded paths)
        // Certificates are stored in nginxconfig/letsencrypt, not /etc/letsencrypt
        $letsencryptDir = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getLetsEncryptLiveDir($domain);
        $certPath = "$letsencryptDir/fullchain.pem";
        
        if (!file_exists($certPath)) {
            $this->error("Certificate file not found: $certPath");
            return;
        }
        
        // Get certificate information using openssl
        $result = $this->executeCommand('openssl', [
            'x509', '-in', $certPath, '-text', '-noout'
        ]);
        
        if ($result['success']) {
            // Parse certificate info
            $output = $result['output'];
            
            // Extract expiry date
            if (preg_match('/Not After : (.+)/', $output, $matches)) {
                $expiryDate = trim($matches[1]);
                $this->info("Certificate expires: $expiryDate");
                
                // Calculate days until expiry
                $expiryTimestamp = strtotime($expiryDate);
                $daysUntilExpiry = ceil(($expiryTimestamp - time()) / 86400);
                
                if ($daysUntilExpiry > 30) {
                    $this->info("Days until expiry: $daysUntilExpiry (OK)");
                } elseif ($daysUntilExpiry > 7) {
                    $this->warn("Days until expiry: $daysUntilExpiry (Warning)");
                } else {
                    $this->error("Days until expiry: $daysUntilExpiry (Critical)");
                }
            }
            
            // Extract issuer
            if (preg_match('/Issuer: (.+)/', $output, $matches)) {
                $issuer = trim($matches[1]);
                $this->info("Issuer: $issuer");
            }
            
            // Extract subject
            if (preg_match('/Subject: (.+)/', $output, $matches)) {
                $subject = trim($matches[1]);
                $this->info("Subject: $subject");
            }
        }
        
        // Show file paths
        $this->info("Certificate files:");
        $this->info("  Certificate: /etc/letsencrypt/live/$domain/fullchain.pem");
        $this->info("  Private Key: /etc/letsencrypt/live/$domain/privkey.pem");
        $this->info("  Chain: /etc/letsencrypt/live/$domain/chain.pem");
    }
    
    /**
     * Show usage information
     */
    private function showUsage(): int
    {
        $this->info("SSL Certificate Management Commands:");
        $this->info("");
        $this->info("Generate certificate:");
        $this->info("  php artisan servermanager:ssl generate example.com --email=admin@example.com");
        $this->info("");
        $this->info("Renew specific certificate:");
        $this->info("  php artisan servermanager:ssl renew example.com");
        $this->info("");
        $this->info("Renew all certificates:");
        $this->info("  php artisan servermanager:ssl renew --all");
        $this->info("");
        $this->info("List all certificates:");
        $this->info("  php artisan servermanager:ssl list");
        $this->info("");
        $this->info("Show certificate status:");
        $this->info("  php artisan servermanager:ssl status example.com");
        $this->info("");
        
        return 0;
    }

    /**
     * Show SSL configuration
     */
    private function showConfiguration(): int
    {
        try {
            $this->info("=== SSL Configuration ===");

            // Show default settings
            $defaultProvider = ServerManagerV1SSLConfigReader::getDefaultProvider();
            $defaultEmail = ServerManagerV1SSLConfigReader::getDefaultEmail();
            $staging = ServerManagerV1SSLConfigReader::isStagingMode();

            $this->info("Default Provider: $defaultProvider");
            $this->info("Default Email: $defaultEmail");
            $this->info("Staging Mode: " . ($staging ? 'Enabled' : 'Disabled'));

            // Show available providers
            $this->info("");
            $this->info("Available Providers:");
            $providers = ServerManagerV1SSLConfigReader::getAvailableProviders();

            foreach ($providers as $name => $provider) {
                $status = $provider['enabled'] ?? true ? 'Enabled' : 'Disabled';
                $this->info("  - $name ({$provider['challenge_type']}) - $status");
                $this->info("    {$provider['description']}");
            }

            // Show deployment settings
            $this->info("");
            $this->info("Deployment Settings:");
            $autoSSL = ServerManagerV1SSLConfigReader::isAutoSSLEnabled();
            $autoBackup = ServerManagerV1SSLConfigReader::isAutoBackupEnabled();
            $phpVersion = ServerManagerV1SSLConfigReader::getDefaultPhpVersion();
            $webRoot = ServerManagerV1SSLConfigReader::getDefaultWebRoot();

            $this->info("  Auto SSL: " . ($autoSSL ? 'Enabled' : 'Disabled'));
            $this->info("  Auto Backup: " . ($autoBackup ? 'Enabled' : 'Disabled'));
            $this->info("  Default PHP Version: $phpVersion");
            $this->info("  Default Web Root: $webRoot");

            // Show nginx paths
            $this->info("");
            $this->info("Nginx Paths:");
            $nginxPaths = ServerManagerV1SSLConfigReader::getNginxPaths();
            $this->info("  Config Path: {$nginxPaths['config_path']}");
            $this->info("  Enabled Path: {$nginxPaths['enabled_path']}");
            $this->info("  Backup Path: {$nginxPaths['backup_path']}");

            // Show security settings
            $this->info("");
            $this->info("Security Settings:");
            $rateLimit = ServerManagerV1SSLConfigReader::getDeploymentRateLimit();
            $requiresConfirmation = ServerManagerV1SSLConfigReader::requiresConfirmation();

            $this->info("  Rate Limit: $rateLimit deployments per hour");
            $this->info("  Requires Confirmation: " . ($requiresConfirmation ? 'Yes' : 'No'));

            // Validate configuration
            $this->info("");
            $this->info("Configuration Validation:");
            $errors = ServerManagerV1SSLConfigReader::validateConfig();

            if (empty($errors)) {
                $this->info("  ✅ Configuration is valid");
            } else {
                $this->error("  ❌ Configuration has errors:");
                foreach ($errors as $error) {
                    $this->error("    - $error");
                }
            }

            $this->info("");
            // Use PathMapper for environment-aware path (no hardcoded paths)
            $wwwroot = \App\Providers\PathMapper::mapWebPath('wwwroot');
            $this->info("Configuration file: $wwwroot/core_node/.secret_keys/.secret_ignore");

            return 0;

        } catch (\Exception $e) {
            $this->error("Failed to load SSL configuration: " . $e->getMessage());
            if (strpos($e->getMessage(), 'dd.sh') !== false) {
                // Use PathMapper for environment-aware path (no hardcoded paths)
                $wwwroot = \App\Providers\PathMapper::mapWebPath('wwwroot');
                $this->warn("Please run: bash $wwwroot/core_node/scripts/dd.sh");
            }
            return 1;
        }
    }
}
