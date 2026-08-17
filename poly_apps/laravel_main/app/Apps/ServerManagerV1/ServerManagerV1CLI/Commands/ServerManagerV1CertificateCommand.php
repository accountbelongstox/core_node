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
                            {action : Action to perform (add|find|list|summary|update|reconcile|renew-all)}
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
        // This ensures open_basedir restrictions are correct (matches 34_configure_php85.sh)
        $this->initializeCommand();

        $action = $this->argument('action');
        $domain = $this->argument('domain');

        return match($action) {
            'add' => $this->addCertificate($domain),
            'find' => $this->findCertificate($domain),
            'list' => $this->listCertificates(),
            'summary' => $this->showSummary(),
            'update' => $this->updateCertificate($domain),
            'reconcile' => $this->reconcileLineages(),
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
                $this->line("    Expires: " . ($cert['expires_at'] ?? 'unknown'));
                $domains = $cert['domains'] ?? [];
                if (!empty($domains)) {
                    $this->line("    Domains: " . implode(', ', $domains));
                }
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
        $this->line("  renew-all        - Renew all certificates expiring soon");
        $this->line("");
        $this->info("Options:");
        $this->line("  --prefixes       - Subdomain prefixes (default: si,sz,local,api)");
        $this->line("  --provider       - SSL provider (default: dnspod)");
        $this->line("  --status         - Certificate status for update");
        $this->line("  --days           - Days threshold for renewal (default: 30)");
        $this->line("  --dry-run        - Check renewals without executing");
        $this->line("");
        $this->info("Examples:");
        $this->line("  php artisan servermanager:certificate add example.com");
        $this->line("  php artisan servermanager:certificate find api.example.com");
        $this->line("  php artisan servermanager:certificate list");
        $this->line("  php artisan servermanager:certificate summary");
        $this->line("  php artisan servermanager:certificate renew-all");
        $this->line("  php artisan servermanager:certificate renew-all --dry-run");

        return 0;
    }

    /**
     * Renew all certificates that are expiring soon
     */
    private function renewAllCertificates(): int
    {
        $daysThreshold = (int)($this->option('days') ?: 30);
        $dryRun = $this->option('dry-run');

        $this->info("Certificate Renewal Process");
        $this->info("Days threshold: $daysThreshold days");
        if ($dryRun) {
            $this->warn("DRY RUN MODE - No certificates will be renewed");
        }
        $this->line("");

        // Informational list (the store snapshot may be stale); certbot itself
        // is the authority on which certificates are actually due.
        $needingRenewal = ServerManagerV1CertificateManager::getCertificatesNeedingRenewal($daysThreshold);

        if (empty($needingRenewal)) {
            $this->info("No certificates near expiry per the tracked store; certbot makes the final call below");
        } else {
            $this->info("Certificates needing renewal: " . count($needingRenewal));
            $this->line("");

            foreach ($needingRenewal as $cert) {
                $domain = $cert['base_domain'];
                $daysLeft = $cert['days_until_expiry'];
                $status = $cert['is_expired'] ? 'EXPIRED' : "Expires in $daysLeft days";

                $this->line("Certificate: $domain");
                $this->line("  Status: $status");
                $this->line("  Expiry: " . $cert['expires_at']);
                $this->line("  Domains: " . count($cert['domains']));
                $this->line("");
            }
        }

        if ($dryRun) {
            $this->info("DRY RUN completed - no changes made");
            return 0;
        }

        // Reconcile stale renewal credentials across ALL certbot-managed
        // renewal configs (not gated by the store snapshot): certificates
        // issued before the persistent credentials file existed reference a
        // deleted dnspod-<timestamp>.ini, which fails every `certbot renew`.
        // `certbot reconfigure` (official mechanism, certbot >= 2.3) re-points
        // each config at the canonical persistent credentials file. Then
        // repair lineages certbot skips entirely (fullchain mismatch).
        $letsEncryptDir = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getLetsEncryptDir();
        $this->reconcileAllRenewalCredentials($letsEncryptDir);
        $this->repairBrokenLineages($letsEncryptDir);

        // Execute certbot renew (self-gates: renews only near-expiry
        // certificates and is a no-op otherwise, per the official contract).
        // Serialize through the same canonical flock the shell self-heal layer
        // uses (/run/lock/core_node_certbot.lock): timer runs, startup passes,
        // UI-triggered renewals and this command queue instead of aborting
        // with "Another instance of Certbot is already running".
        $this->info("Starting certificate renewal with certbot...");

        $command = [
            'renew',
            '--config-dir', $letsEncryptDir,
            '--work-dir', $letsEncryptDir . '/work',
            '--logs-dir', $letsEncryptDir . '/logs',
            '--quiet',
            '--no-random-sleep-on-renew'
        ];

        if (is_executable('/usr/bin/flock')) {
            $result = $this->executeCommand('flock', array_merge(
                ['-w', '180', \App\Apps\ServerManagerV1\ServerManagerV1Gvar\ServerManagerV1Constants::CERTBOT_FLOCK_LOCK, 'certbot'],
                $command
            ));
        } else {
            $result = $this->executeCommand('certbot', $command);
        }

        if ($result['success']) {
            $this->info("Certificate renewal completed successfully");

            // Reload nginx
            $this->info("Reloading nginx to apply new certificates...");
            $nginxResult = $this->executeCommand('systemctl', ['reload', 'nginx']);

            if ($nginxResult['success']) {
                $this->info("Nginx reloaded successfully");
            } else {
                $this->warn("Failed to reload nginx");
                $this->line("Error: " . ($nginxResult['error'] ?? 'Unknown error'));
            }

            // Show updated summary
            $this->line("");
            $this->info("Updated certificate status:");
            return $this->showSummary();
        } else {
            $this->error("Certificate renewal failed");
            if (!empty($result['output'])) {
                $this->line("Output: " . $result['output']);
            }
            if (!empty($result['error'])) {
                $this->line("Error: " . $result['error']);
            }
            return 1;
        }
    }

    /**
     * Reconcile every certbot-managed lineage WITHOUT renewing: re-point stale
     * credential references (official `certbot reconfigure`) and repair broken
     * lineages (fullchain mismatch) via `certbot certonly --force-renewal`.
     * This is the shell self-heal layer's reconcile step; `renew-all` runs the
     * same steps and then a single `certbot renew`.
     */
    private function reconcileLineages(): int
    {
        $letsEncryptDir = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getLetsEncryptDir();
        $this->reconcileAllRenewalCredentials($letsEncryptDir);
        $this->repairBrokenLineages($letsEncryptDir);
        return 0;
    }

    /**
     * Repair broken certbot lineages. A lineage whose live fullchain.pem does
     * not equal cert.pem + chain.pem is SKIPPED by every certbot operation
     * ("fullchain does not match cert + chain ... Skipping"), which also hides
     * the certificate from `certbot certificates`. This state arises when the
     * self-signed fallback overwrote cert.pem in place. Official recovery:
     * `certbot certonly --force-renewal --cert-name <name>` re-issues the
     * certificate and rewrites the whole lineage consistently.
     */
    private function repairBrokenLineages(string $letsEncryptDir): void
    {
        $renewalConfs = is_dir($letsEncryptDir . '/renewal') ? (glob($letsEncryptDir . '/renewal/*.conf') ?: []) : [];
        $credentials = null;

        foreach ($renewalConfs as $renewalConf) {
            $certName = basename($renewalConf, '.conf');
            $liveDir = $letsEncryptDir . '/live/' . $certName;
            $cert = @file_get_contents($liveDir . '/cert.pem');
            $chain = @file_get_contents($liveDir . '/chain.pem');
            $fullchain = @file_get_contents($liveDir . '/fullchain.pem');
            if ($cert === false || $chain === false || $fullchain === false || $fullchain === $cert . $chain) {
                continue; // consistent, or unreadable (nothing to repair here)
            }

            if ($credentials === null) {
                $credentials = $this->getDNSCredentials('dnspod');
                if (!$credentials) {
                    $this->warn('DNSPod credentials unavailable; skipping broken-lineage repair');
                    return;
                }
            }

            $this->warn("Broken lineage detected: $certName (fullchain != cert + chain); re-issuing with --force-renewal...");
            $this->forceRenewLineage($certName, $credentials, $letsEncryptDir);
        }
    }

    /** Canonical working DNSPod authenticator (maintained third-party plugin). */
    private const DNSPOD_AUTHENTICATOR = 'certbot-dnspod';

    /**
     * Domains of a lineage: the ServerManager issuance record is canonical
     * (the domains the certificate was created with); the live certificate's
     * SANs are the fallback. A SAN parse alone is never trusted — the
     * self-signed fallback certs carry no meaningful SANs.
     */
    private function lineageDomains(string $certName, string $letsEncryptDir): array
    {
        $summary = ServerManagerV1CertificateManager::getCertificatesSummary();
        foreach ($summary['certificates'] ?? [] as $cert) {
            if (($cert['base_domain'] ?? '') === $certName && !empty($cert['domains'])) {
                return array_values($cert['domains']);
            }
        }

        $liveDir = $letsEncryptDir . '/live/' . $certName;
        foreach (['cert.pem', 'fullchain.pem'] as $pemName) {
            $pem = @file_get_contents($liveDir . '/' . $pemName);
            if ($pem === false) {
                continue;
            }
            $parsed = openssl_x509_parse($pem);
            $san = (string)($parsed['extensions']['subjectAltName'] ?? '');
            $domains = [];
            foreach (explode(',', $san) as $entry) {
                $entry = trim($entry);
                if (str_starts_with($entry, 'DNS:')) {
                    $domains[] = substr($entry, 4);
                }
            }
            if (!empty($domains)) {
                return $domains;
            }
        }

        return [];
    }

    /**
     * Re-issue one lineage with --force-renewal using the canonical working
     * DNSPod authenticator (official per-certificate renewal path). This also
     * migrates the recorded authenticator/credentials in the renewal config,
     * so every future `certbot renew` uses the working plugin.
     */
    private function forceRenewLineage(string $certName, string $letsEncryptDir): bool
    {
        $domains = $this->lineageDomains($certName, $letsEncryptDir);
        // Union with the canonical expanded SAN list: a lineage issued with an
        // older prefix set gains the current wildcards (e.g. *.sh./ *.hk.) on
        // re-issue; the apex and *.apex are always included.
        if (strpos($certName, '*') === false && strpos($certName, '.') !== false) {
            $domains = array_values(array_unique(array_merge(
                $domains,
                ServerManagerV1CertificateManager::generateExpandedDomains($certName)
            )));
        }
        if (empty($domains)) {
            $this->warn("  Cannot determine domains for $certName (no store record, no SANs); manual repair required");
            return false;
        }

        $this->info("Executing: certbot " . implode(' ', ServerManagerV1CertificateManager::buildDNSPodCertbotCommand($domains, ['--force-renewal', '--cert-name', $certName]) ?? []));
        $result = ServerManagerV1CertificateManager::runDNSPodCertbot($domains, [
            '--force-renewal',
            '--cert-name', $certName,
        ]);
        if ($result['success']) {
            $this->info("  Lineage re-issued: $certName (" . count($domains) . " domains)");
            return true;
        }
        $this->warn("  force-renewal failed for $certName: " . ($result['error'] ?? $result['output'] ?? 'unknown'));
        return false;
    }

    /**
     * Reconcile stale renewal configs for EVERY certbot-managed certificate
     * (official certbot >= 2.3 `reconfigure` mechanism). Certificates issued
     * before the persistent credentials file existed reference a deleted
     * dnspod-<timestamp>.ini in <config-dir>/renewal/<name>.conf, which makes
     * every `certbot renew` fail with "File not found". For each config whose
     * recorded credentials file is missing, ensure the canonical persistent
     * credentials file and re-point the renewal config at it. The scan covers
     * all renewal confs on disk (certbot is the authority), not just the ones
     * the ServerManager store happens to track.
     */
    private function reconcileAllRenewalCredentials(string $letsEncryptDir): void
    {
        $renewalDir = $letsEncryptDir . '/renewal';
        $renewalConfs = is_dir($renewalDir) ? (glob($renewalDir . '/*.conf') ?: []) : [];
        if (empty($renewalConfs)) {
            return;
        }

        $credentials = null;

        foreach ($renewalConfs as $renewalConf) {
            $certName = basename($renewalConf, '.conf');
            $confContent = file_get_contents($renewalConf);
            if ($confContent === false
                || preg_match('/^\s*[\w-]*credentials\s*=\s*(\S+)\s*$/m', $confContent, $credMatch) !== 1
                || is_file($credMatch[1])) {
                continue; // no credentials reference, or the recorded file is alive
            }

            if (preg_match('/^\s*authenticator\s*=\s*(\S+)\s*$/m', $confContent, $authMatch) !== 1) {
                continue;
            }
            $authenticator = $authMatch[1];

            if ($credentials === null) {
                $credentials = $this->getDNSCredentials('dnspod');
                if (!$credentials) {
                    $this->warn('DNSPod credentials unavailable; skipping renewal-config reconciliation');
                    return;
                }
            }

            if ($authenticator !== self::DNSPOD_AUTHENTICATOR) {
                // Legacy/broken authenticator recorded (e.g. the zope-era
                // dns-dnspod plugin, which cannot even load on modern
                // certbot): reconfigure cannot fix that. Re-issue with the
                // canonical working plugin, which also migrates the recorded
                // authenticator/credentials for future renewals.
                $this->info("Migrating $certName from authenticator '$authenticator' to '" . self::DNSPOD_AUTHENTICATOR . "'...");
                $this->forceRenewLineage($certName, $letsEncryptDir);
                continue;
            }

            $credentialsPath = ServerManagerV1CertificateManager::ensureDNSPodCredentialsFile($credentials);
            if (!$credentialsPath) {
                continue;
            }

            $this->info("Reconciling renewal config for $certName (stale credentials {$credMatch[1]} -> $credentialsPath)...");
            $result = $this->executeCommand('certbot', [
                'reconfigure',
                '--config-dir', $letsEncryptDir,
                '--work-dir', $letsEncryptDir . '/work',
                '--logs-dir', $letsEncryptDir . '/logs',
                '--cert-name', $certName,
                '--' . $authenticator . '-credentials', $credentialsPath,
            ]);

            if ($result['success']) {
                $this->info("  Renewal config reconciled: $certName");
            } else {
                $this->warn("  reconfigure failed for $certName: " . ($result['error'] ?? $result['output'] ?? 'unknown'));
            }
        }
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

            // The canonical working DNSPod authenticator only. The zope-era
            // dns-dnspod plugin cannot load on modern certbot and is never
            // offered; manual is not automatable.
            $dnsPlugins = [
                'certbot-dnspod',      // Third-party DNSPod plugin (maintained)
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

        $this->info("SSL command output:");
        $result = ServerManagerV1CertificateManager::runDNSPodCertbot($domains);

        $this->line("Certbot result: " . ($result['success'] ? 'success' : 'failed'));
        if (!empty($result['output'])) {
            $this->line("Output: " . $result['output']);
        }
        if (!empty($result['error'])) {
            $this->line("Error: " . $result['error']);
        }

        return $result['success'];
    }

    /**
     * Generate certificate using manual DNS challenge or self-signed fallback
     */
    private function generateManualCertificate(string $baseDomain, array $domains): bool
    {
        $this->error("Manual DNS challenge is not supported in automated scripts");
        $this->info("DNSPod plugin is not available. Please install certbot-dnspod or use a different provider.");
        $this->info("To install the DNSPod plugin: bash scripts/shells/linux/debian/install_shells/27_install_certbot.sh");

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
            // Single resolver (CertificateManager): canonical secret file
            // names with legacy fallback.
            $credentials = ServerManagerV1CertificateManager::getDNSPodCredentials();
            if ($credentials === null) {
                return null;
            }

            return $credentials;

        } catch (\Exception $e) {
            $this->error("Failed to get DNS credentials: " . $e->getMessage());
            return null;
        }
    }
}
