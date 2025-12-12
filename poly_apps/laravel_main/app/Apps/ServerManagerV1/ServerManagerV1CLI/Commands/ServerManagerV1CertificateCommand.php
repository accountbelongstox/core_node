<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands;

use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1CertificateManager;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1DomainManager;
use App\Providers\PathMapper;
use Illuminate\Support\Facades\Log;

class ServerManagerV1CertificateCommand extends ServerManagerV1BaseCommand
{
    // TODO: Web API version available at ServerManagerV1CertificateManagerCtl
    // API endpoints: GET /api/certificates, POST /api/certificates, etc.

    /**
     * The name and signature of the console command.
     */
    protected $signature = 'servermanager:certificate
                            {action : Action to perform (add|find|list|summary|update|renew-all)}
                            {domain? : Domain name (required for add, find, update)}
                            {--prefixes= : Subdomain prefixes (comma-separated, default: si,sz,local,api)}
                            {--provider= : SSL provider (default: dnspod)}
                            {--status= : Certificate status for update}
                            {--days= : Days threshold for renewal (default: 30)}
                            {--dry-run : Check which certificates need renewal without actually renewing}';

    /**
     * The console command description.
     */
    protected $description = 'Manage SSL certificates with expanded domain coverage';

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
            'add' => $this->addCertificate($domain),
            'find' => $this->findCertificate($domain),
            'list' => $this->listCertificates(),
            'summary' => $this->showSummary(),
            'update' => $this->updateCertificate($domain),
            'renew-all' => $this->renewAllCertificates(),
            default => $this->showHelp()
        };
    }

    /**
     * Add certificate for domain
     */
    private function addCertificate(?string $domain): int
    {
        if (!$domain) {
            $this->error("Domain is required for add action");
            return 1;
        }

        if (!$this->validateDomain($domain)) {
            return 1;
        }

        // Process domain to ensure base domain format
        $baseDomain = $domain;
        if (strpos($baseDomain, 'www.') === 0) {
            $baseDomain = substr($baseDomain, 4);
        }

        $prefixes = $this->option('prefixes') ?: 'si,sz,local,api';
        $provider = $this->option('provider') ?: 'dnspod';

        $this->info("Adding certificate for: $baseDomain");
        $this->info("Subdomain prefixes: $prefixes");
        $this->info("Provider: $provider");

        // Use the CertificateManager to generate expanded domains
        $domains = ServerManagerV1CertificateManager::generateExpandedDomains($baseDomain);

        $this->info("Certificate will cover domains:");
        foreach ($domains as $d) {
            $this->line("  - $d");
        }

        // Generate certificate using DNS challenge
        $this->info("Generating SSL certificate with expanded domain coverage...");
        $certResult = $this->generateCertificateWithDNS($baseDomain, $domains, $provider);

        if (!$certResult) {
            $this->error("Failed to generate certificate");
            return 1;
        }

        // Copy or link certificates from letsencrypt to ssl directory
        $cleanDomain = trim(preg_replace('/[\r\n\t]/', '', $baseDomain));
        $this->copyCertificatesToSslDir($cleanDomain);

        // Add certificate to database
        $result = ServerManagerV1CertificateManager::addCertificate($baseDomain, [
            'provider' => $provider,
            'status' => 'active',
            'auto_renew' => true,
            'domains' => $domains
        ]);

        if ($result) {
            $certId = 'cert_' . str_replace('.', '_', $baseDomain);
            $this->info("Certificate added successfully!");
            $this->info("Certificate ID: $certId");
            $certPath = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getLetsEncryptLiveDir($cleanDomain);
            $this->info("Certificate path: $certPath/");
            return 0;
        } else {
            $this->error("Failed to add certificate to database");
            return 1;
        }
    }

    /**
     * Copy or link certificates from Let's Encrypt to SSL directory
     * This ensures certificates are available in both locations for compatibility
     *
     * @param string $domain The domain name
     * @return bool True if successful, false otherwise
     */
    private function copyCertificatesToSslDir(string $domain): bool
    {
        try {
            $cleanDomain = trim(preg_replace('/[\r\n\t]/', '', $domain));

            // Get source directory (Let's Encrypt live certificates)
            $sourceDir = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getLetsEncryptLiveDir($cleanDomain);

            // Get target directory (SSL certificates directory)
            $targetDir = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getSslCertDir($cleanDomain);

            // Check if source directory exists
            if (!is_dir($sourceDir)) {
                $this->warn("Let's Encrypt certificates not found at: $sourceDir");
                return false;
            }

            // Create target directory if it doesn't exist
            if (!is_dir($targetDir)) {
                if (!mkdir($targetDir, 0755, true)) {
                    $this->error("Failed to create SSL certificate directory: $targetDir");
                    return false;
                }
            }

            // Certificate files to copy/link
            $certFiles = ['fullchain.pem', 'privkey.pem', 'chain.pem', 'cert.pem'];

            foreach ($certFiles as $file) {
                $sourcePath = $sourceDir . '/' . $file;
                $targetPath = $targetDir . '/' . $file;

                // Skip if source file doesn't exist
                if (!file_exists($sourcePath)) {
                    continue;
                }

                // Remove existing target file or symlink
                if (file_exists($targetPath) || is_link($targetPath)) {
                    unlink($targetPath);
                }

                // Create symlink from target to source
                if (!symlink($sourcePath, $targetPath)) {
                    $this->warn("Failed to create symlink for: $file");
                    // Fall back to copying
                    if (!copy($sourcePath, $targetPath)) {
                        $this->warn("Failed to copy: $file");
                        continue;
                    }
                    chmod($targetPath, ($file === 'privkey.pem') ? 0600 : 0644);
                }
            }

            $this->info("Certificates linked/copied to: $targetDir");
            return true;

        } catch (\Exception $e) {
            $this->error("Failed to copy certificates: " . $e->getMessage());
            Log::error("Certificate copy failed", [
                'domain' => $domain,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return false;
        }
    }

    /**
     * Find certificate for domain
     */
    private function findCertificate(?string $domain): int
    {
        if (!$domain) {
            $this->error("Domain is required for find action");
            return 1;
        }

        $this->info("Searching for certificate covering: $domain");

        $certificate = ServerManagerV1CertificateManager::findCertificateForDomain($domain);

        if ($certificate) {
            $this->info("Found certificate:");
            $this->line("  ID: " . $certificate['id']);
            $this->line("  Base domain: " . $certificate['base_domain']);
            $this->line("  Status: " . $certificate['status']);
            $this->line("  Provider: " . $certificate['provider']);
            $this->line("  Auto renew: " . ($certificate['auto_renew'] ? 'yes' : 'no'));
            $this->line("  Created: " . $certificate['created_at']);
            $this->line("  Updated: " . $certificate['updated_at']);

            if (isset($certificate['expires_at'])) {
                $this->line("  Expires: " . $certificate['expires_at']);
            }

            $this->info("Covered domains:");
            foreach ($certificate['domains'] as $d) {
                $this->line("  - $d");
            }

            return 0;
        } else {
            $this->warn("No certificate found covering domain: $domain");
            return 1;
        }
    }

    /**
     * List all certificates
     */
    private function listCertificates(): int
    {
        $certificates = ServerManagerV1CertificateManager::getAllCertificates();

        if (empty($certificates)) {
            $this->info("No certificates found");
            return 0;
        }

        $this->info("All certificates:");
        $this->line("");

        foreach ($certificates as $cert) {
            $this->line("Certificate: " . $cert['id']);
            $this->line("  Base domain: " . $cert['base_domain']);
            $this->line("  Status: " . $cert['status']);
            $this->line("  Provider: " . $cert['provider']);
            $this->line("  Domains: " . count($cert['domains']));
            $this->line("  Created: " . $cert['created_at']);
            
            if (isset($cert['expires_at'])) {
                $this->line("  Expires: " . $cert['expires_at']);
            }
            
            $this->line("");
        }

        return 0;
    }

    /**
     * Show certificates summary
     */
    private function showSummary(): int
    {
        $summary = ServerManagerV1CertificateManager::getCertificatesSummary();

        $this->info("Certificates Summary:");
        $this->line("  Total certificates: " . $summary['total_certificates']);
        $this->line("  Active certificates: " . $summary['active_certificates']);
        $this->line("  Expired certificates: " . $summary['expired_certificates']);
        $this->line("  Expiring soon (30 days): " . $summary['expiring_soon']);
        $this->line("");

        if (!empty($summary['certificates'])) {
            $this->info("Certificate details:");
            foreach ($summary['certificates'] as $cert) {
                $status = $cert['status'];
                $statusColor = match($status) {
                    'active' => 'info',
                    'expired' => 'error',
                    'failed' => 'error',
                    default => 'comment'
                };

                $this->line("  " . $cert['base_domain'] . " (" . $cert['domain_count'] . " domains) - " . 
                           "<$statusColor>" . $status . "</$statusColor>");
            }
        }

        return 0;
    }

    /**
     * Update certificate status
     */
    private function updateCertificate(?string $domain): int
    {
        if (!$domain) {
            $this->error("Domain is required for update action");
            return 1;
        }

        $status = $this->option('status');
        if (!$status) {
            $this->error("Status is required for update action (use --status)");
            return 1;
        }

        $this->info("Updating certificate status for: $domain");
        $this->info("New status: $status");

        $result = ServerManagerV1CertificateManager::updateCertificateStatus($domain, $status);

        if ($result) {
            $this->info("Certificate status updated successfully");
            return 0;
        } else {
            $this->error("Failed to update certificate status");
            return 1;
        }
    }

    /**
     * Show help information
     */
    private function showHelp(): int
    {
        $this->info("ServerManager Certificate Management");
        $this->line("");
        $this->info("Available actions:");
        $this->line("  add <domain>     - Add certificate with expanded domain coverage");
        $this->line("  find <domain>    - Find certificate covering a domain");
        $this->line("  list             - List all certificates");
        $this->line("  summary          - Show certificates summary");
        $this->line("  update <domain>  - Update certificate status");
        $this->line("");
        $this->info("Options:");
        $this->line("  --prefixes       - Subdomain prefixes (default: si,sz,local,api)");
        $this->line("  --provider       - SSL provider (default: dnspod)");
        $this->line("  --status         - Certificate status for update");
        $this->line("");
        $this->info("Examples:");
        $this->line("  php artisan servermanager:certificate add example.com");
        $this->line("  php artisan servermanager:certificate find api.example.com");
        $this->line("  php artisan servermanager:certificate list");
        $this->line("  php artisan servermanager:certificate summary");

        return 0;
    }

    /**
     * Generate certificate using DNS challenge
     */
    private function generateCertificateWithDNS(string $baseDomain, array $domains, string $provider): bool
    {
        try {
            // Check available certbot plugins
            $pluginsResult = $this->executeCommand('certbot', ['plugins']);
            $availablePlugins = $pluginsResult['output'] ?? '';

            $this->info("Available certbot plugins:");
            $this->line($availablePlugins);

            // Try different DNSPod plugin options
            $dnsPlugins = [
                'certbot-dnspod',      // Third-party DNSPod plugin
                'dns-dnspod',          // Alternative name
                'manual'               // Fallback to manual (disabled for automation)
            ];

            foreach ($dnsPlugins as $plugin) {
                if ($plugin === 'manual' || strpos($availablePlugins, $plugin) !== false) {
                    $this->info("Using plugin: $plugin");
                    return $this->generateCertificateWithPlugin($baseDomain, $domains, $plugin, $provider);
                }
            }

            $this->error("No suitable DNS plugin found for DNSPod");
            return false;

        } catch (\Exception $e) {
            $this->error("Certificate generation failed: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Generate certificate with specific plugin
     */
    private function generateCertificateWithPlugin(string $baseDomain, array $domains, string $plugin, string $provider): bool
    {
        if ($plugin === 'manual') {
            return $this->generateManualCertificate($baseDomain, $domains);
        }

        // For DNS plugins, we need credentials
        $credentials = $this->getDNSCredentials($provider);
        if (!$credentials) {
            $this->error("Failed to get DNS credentials");
            return false;
        }

        // Create credentials file (pass plugin type to generate correct format)
        $credentialsPath = $this->createCredentialsFile($credentials, $provider, $plugin);
        if (!$credentialsPath) {
            $this->error("Failed to create credentials file");
            return false;
        }

        try {
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

            // Certificate expiry check and automatic renewal
            // Certificates naturally expire - check and renew as needed
            $baseDomain = $domains[0] ?? '';

            if ($baseDomain) {
                $expiryInfo = $this->checkCertificateExpiry($baseDomain);
                if ($expiryInfo['exists'] && !$expiryInfo['expired'] && !$expiryInfo['expiring_soon']) {
                    $this->info("Certificate for $baseDomain already exists and is valid for {$expiryInfo['days_until_expiry']} more days.");
                    $this->info("Certificate will be automatically renewed when it expires or is expiring soon (< 30 days).");
                    return true;
                } elseif ($expiryInfo['exists'] && ($expiryInfo['expired'] || $expiryInfo['expiring_soon'])) {
                    $this->warn("Certificate for $baseDomain is " . ($expiryInfo['expired'] ? 'expired' : "expiring in {$expiryInfo['days_until_expiry']} days") . ". Regenerating...");
                } else {
                    $this->info("No existing certificate found for $baseDomain. Generating new certificate...");
                }
            }

            // Build command based on plugin type
            if ($plugin === 'certbot-dnspod') {
                // Third-party DNSPod plugin uses different parameter format
                $command = [
                    'certonly',
                    '--config-dir', $configDir,
                    '--work-dir', $workDir,
                    '--logs-dir', $logsDir,
                    '--authenticator', 'certbot-dnspod',
                    '--certbot-dnspod-credentials', $credentialsPath,
                    '--email', $credentials['email'],
                    '--agree-tos',
                    '--non-interactive'
                ];
            } else {
                // Standard DNS plugin format
                // Use --authenticator instead of --dns-dnspod to avoid ambiguous option error
                $command = [
                    'certonly',
                    '--config-dir', $configDir,
                    '--work-dir', $workDir,
                    '--logs-dir', $logsDir,
                    '--authenticator', $plugin,
                    '--' . $plugin . '-credentials', $credentialsPath,
                    '--email', $credentials['email'],
                    '--agree-tos',
                    '--non-interactive'
                ];
            }

            // Add all domains
            foreach ($domains as $domain) {
                $command[] = '-d';
                $command[] = $domain;
            }

            $this->info("SSL command output:");
            $result = $this->executeCommand('certbot', $command);

            $this->line("Certbot result: " . ($result['success'] ? 'success' : 'failed'));
            if (!empty($result['output'])) {
                $this->line("Output: " . $result['output']);
            }
            if (!empty($result['error'])) {
                $this->line("Error: " . $result['error']);
            }

            return $result['success'];

        } finally {
            // Clean up credentials file
            if (file_exists($credentialsPath)) {
                unlink($credentialsPath);
            }
        }
    }

    /**
     * Generate certificate using manual DNS challenge or self-signed fallback
     */
    private function generateManualCertificate(string $baseDomain, array $domains): bool
    {
        $this->error("Manual DNS challenge is not supported in automated scripts");
        $this->info("Available DNS plugins: dns-cloudflare, dns-route53");
        $this->info("DNSPod plugin is not available. Please install certbot-dns-dnspod or use a different provider.");
        $this->info("To install DNSPod plugin: pip install certbot-dns-dnspod");

        // Generate self-signed certificate for testing
        $this->warn("Generating self-signed certificate for testing purposes...");
        return $this->generateSelfSignedCertificate($baseDomain, $domains);
    }

    /**
     * Generate self-signed certificate for testing
     */
    private function generateSelfSignedCertificate(string $baseDomain, array $domains): bool
    {
        // Clean domain name to remove any whitespace or control characters
        $cleanDomain = trim(preg_replace('/[\r\n\t]/', '', $baseDomain));

        $certDir = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getSslCertDir($cleanDomain);
        $keyFile = "$certDir/privkey.pem";
        $certFile = "$certDir/fullchain.pem";

        // Create certificate directory
        $result = $this->executeCommand('mkdir', ['-p', $certDir]);
        if (!$result['success']) {
            $this->error("Failed to create certificate directory: $certDir");
            return false;
        }

        // Generate private key
        $keyResult = $this->executeCommand('openssl', [
            'genrsa', '-out', $keyFile, '2048'
        ]);

        if (!$keyResult['success']) {
            $this->error("Failed to generate private key");
            return false;
        }

        // Create certificate signing request config
        $configFile = PathMapper::getLaravelTmpDir() . "/cert-config-$baseDomain.conf";
        $config = "[req]\n";
        $config .= "distinguished_name = req_distinguished_name\n";
        $config .= "req_extensions = v3_req\n";
        $config .= "prompt = no\n\n";
        $config .= "[req_distinguished_name]\n";
        $config .= "C = CN\n";
        $config .= "ST = Test\n";
        $config .= "L = Test\n";
        $config .= "O = Test Organization\n";
        $config .= "CN = $baseDomain\n\n";
        $config .= "[v3_req]\n";
        $config .= "keyUsage = keyEncipherment, dataEncipherment\n";
        $config .= "extendedKeyUsage = serverAuth\n";
        $config .= "subjectAltName = @alt_names\n\n";
        $config .= "[alt_names]\n";

        $altIndex = 1;
        foreach ($domains as $domain) {
            $config .= "DNS.$altIndex = $domain\n";
            $altIndex++;
        }

        file_put_contents($configFile, $config);

        // Generate self-signed certificate
        $certResult = $this->executeCommand('openssl', [
            'req', '-new', '-x509', '-key', $keyFile,
            '-out', $certFile, '-days', '365',
            '-config', $configFile
        ]);

        // Clean up config file
        unlink($configFile);

        if (!$certResult['success']) {
            $this->error("Failed to generate self-signed certificate");
            return false;
        }

        // Set proper permissions
        $this->executeCommand('chmod', ['600', $keyFile]);
        $this->executeCommand('chmod', ['644', $certFile]);

        $this->info("Self-signed certificate generated successfully");
        $this->warn("This is a self-signed certificate for testing only!");
        $this->warn("Browsers will show security warnings. Install certbot-dnspod for production use.");

        return true;
    }

    /**
     * Get DNS credentials
     */
    private function getDNSCredentials(string $provider): ?array
    {
        if ($provider !== 'dnspod') {
            return null;
        }

        try {
            $email = \App\Helpers\GlobalSecretReader::getSecretContent('DNS_DNSPOD_EMAILS');
            $apiToken = \App\Helpers\GlobalSecretReader::getSecretContent('DNS_DNSPOD_API_TOKENS');

            if (!$email || !$apiToken) {
                return null;
            }

            // Parse DNSPod API token format: "id,token"
            $tokenParts = explode(',', $apiToken, 2);
            if (count($tokenParts) === 2) {
                return [
                    'email' => $email,
                    'api_id' => trim($tokenParts[0]),
                    'api_token' => trim($tokenParts[1])
                ];
            }

            return null;

        } catch (\Exception $e) {
            $this->error("Failed to get DNS credentials: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Create credentials file
     */
    private function createCredentialsFile(array $credentials, string $provider, string $plugin = 'dns-dnspod'): ?string
    {
        if ($provider !== 'dnspod') {
            return null;
        }

        // Create credentials directory if it doesn't exist
        $credentialsDir = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getSslCredentialsDir();
        if (!is_dir($credentialsDir)) {
            mkdir($credentialsDir, 0755, true);
        }

        $credentialsPath = $credentialsDir . '/dnspod-' . time() . '.ini';

        // Format credentials based on plugin type
        if ($plugin === 'certbot-dnspod') {
            // Third-party certbot-dnspod plugin format
        $content = "certbot_dnspod_token_id = {$credentials['api_id']}\n";
        $content .= "certbot_dnspod_token = {$credentials['api_token']}\n";
        } else {
            // Standard dns-dnspod plugin format
            // The plugin expects: email and api-token (full "id,token" format)
            // But certbot automatically prefixes with "dns_dnspod_" for the credentials file
            // Use quotes to prevent configobj from parsing comma-separated value as a list
            $apiToken = $credentials['api_id'] . ',' . $credentials['api_token'];
            $content = "dns_dnspod_email = {$credentials['email']}\n";
            $content .= "dns_dnspod_api_token = \"{$apiToken}\"\n";
        }

        if (file_put_contents($credentialsPath, $content) === false) {
            return null;
        }

        chmod($credentialsPath, 0600);
        return $credentialsPath;
    }
}
