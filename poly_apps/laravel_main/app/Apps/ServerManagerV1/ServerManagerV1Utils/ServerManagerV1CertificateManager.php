<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use Illuminate\Support\Facades\Log;
use App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig;
use App\Providers\PathMapper;

/**
 * Certificate Management Utility for ServerManagerV1
 *
 * Manages SSL certificates with wildcard support and subdomain expansion.
 *
 * SYNC CONTRACT (two ends, one truth): this is the Laravel end of the
 * certificate flow (issue/renew/ensure via certbot + DNSPod). The shell end
 * is:
 *   scripts/shells/linux/debian/install_shells/35_install_certbot.sh
 *     (tooling + systemd renewal timer for automatic renewal)
 *   scripts/shells/linux/common/domain_setup_common.sh
 *     (domain_setup_issue_certificate -> artisan servermanager:certificate)
 *   scripts/shells/linux/common/nginx_manager.sh (cert-ensure / cert-renew)
 * Any change to providers, prefix expansion, or renewal behavior MUST be
 * applied to both ends in the same change. SAN expansion itself lives in
 * ServerManagerV1DomainExpander (single implementation; the shell end
 * funnels into it through `artisan servermanager:certificate`).
 */
class ServerManagerV1CertificateManager
{
    // Use PathMapper for database directory
    private const CERTIFICATES_FILE = 'certificates.json';

    /**
     * Get certificates database directory
     */
    private static function getCertificatesDbDir(): string
    {
        return PathMapper::mapWebPath('laravel_data_dir') . '/servermanager/certificates';
    }

    /**
     * Resolve the DNSPod API credentials from the secret store — the single
     * resolver shared by the CLI command (issuance / reconcile) and the API
     * controller (DNS provider status). Canonical secret file names on disk
     * are DNSPOD_EMAILS / DNS_DNSPOD_API_TOKENS; the legacy DNS_-prefixed
     * variants are accepted as fallback (SecretStore::get returns '' for a
     * missing file).
     *
     * @return array{email:string, api_id:string, api_token:string}|null
     */
    public static function getDNSPodCredentials(): ?array
    {
        $email = \App\Utils\SecretStore::get('DNSPOD_EMAILS');
        if ($email === '') {
            $email = \App\Utils\SecretStore::get('DNS_DNSPOD_EMAILS');
        }
        $apiToken = \App\Utils\SecretStore::get('DNS_DNSPOD_API_TOKENS');
        if ($apiToken === '') {
            $apiToken = \App\Utils\SecretStore::get('DNSPOD_API_TOKENS');
        }

        if ($email === '' || $apiToken === '') {
            return null;
        }

        // Parse DNSPod API token format: "id,token"
        $tokenParts = explode(',', $apiToken, 2);
        if (count($tokenParts) !== 2) {
            return null;
        }

        return [
            'email' => $email,
            'api_id' => trim($tokenParts[0]),
            'api_token' => trim($tokenParts[1]),
        ];
    }

    // DNS-01 propagation wait passed to the certbot-dnspod plugin. The plugin
    // inherits certbot's dns_common default of 10 seconds, which is too short
    // for DNSPod authoritative sync: the CA then validates before the TXT
    // record is visible and every challenge fails even though the record was
    // created (credentials are NOT the problem in that failure mode).
    private const DNSPOD_PROPAGATION_SECONDS = 60;

    /**
     * Ensure the persistent certbot-dnspod credentials file (official plugin
     * format: certbot_dnspod_token_id / certbot_dnspod_token). Certbot records
     * this path in <config-dir>/renewal/<name>.conf and re-reads it at EVERY
     * renewal, so the file MUST persist — temporary credentials files break
     * `certbot renew`. Content-hash idempotent. Directory 0700, file 0600.
     *
     * @param array{api_id:string, api_token:string} $credentials
     */
    public static function ensureDNSPodCredentialsFile(array $credentials): ?string
    {
        $credentialsDir = ServerManagerV1PathConfig::getSslCredentialsDir();
        if (!is_dir($credentialsDir)) {
            mkdir($credentialsDir, 0700, true);
        } else {
            chmod($credentialsDir, 0700);
        }

        $content = "certbot_dnspod_token_id = {$credentials['api_id']}\n";
        $content .= "certbot_dnspod_token = {$credentials['api_token']}\n";

        $credentialsPath = $credentialsDir . '/certbot-dnspod.ini';

        if (is_file($credentialsPath) && file_get_contents($credentialsPath) === $content) {
            return $credentialsPath;
        }

        if (file_put_contents($credentialsPath, $content) === false) {
            return null;
        }

        chmod($credentialsPath, 0600);
        return $credentialsPath;
    }

    /**
     * Build the canonical DNSPod certbot argument vector (working
     * certbot-dnspod authenticator, persistent credentials file, propagation
     * wait, canonical config/work/log dirs). Single builder shared by the CLI
     * command, the website SSL flow and the API controller — no second
     * implementation may build DNSPod certbot arguments.
     *
     * @return array|null full argument vector (starting with 'certonly'), or
     *                    null when credentials/credentials-file are unavailable
     */
    public static function buildDNSPodCertbotCommand(array $domains, array $extraArgs = []): ?array
    {
        $credentials = self::getDNSPodCredentials();
        if ($credentials === null) {
            return null;
        }

        $credentialsPath = self::ensureDNSPodCredentialsFile($credentials);
        if ($credentialsPath === null) {
            return null;
        }

        $letsEncryptDir = ServerManagerV1PathConfig::getLetsEncryptDir();
        foreach ([$letsEncryptDir, $letsEncryptDir . '/work', $letsEncryptDir . '/logs'] as $dir) {
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
        }

        $command = [
            'certonly',
            '--config-dir', $letsEncryptDir,
            '--work-dir', $letsEncryptDir . '/work',
            '--logs-dir', $letsEncryptDir . '/logs',
            '--authenticator', 'certbot-dnspod',
            '--certbot-dnspod-credentials', $credentialsPath,
            '--certbot-dnspod-propagation-seconds', (string) self::DNSPOD_PROPAGATION_SECONDS,
            '--email', $credentials['email'],
            '--agree-tos', '--non-interactive',
        ];
        foreach ($extraArgs as $arg) {
            $command[] = $arg;
        }
        foreach ($domains as $domain) {
            $command[] = '-d';
            $command[] = $domain;
        }

        return $command;
    }

    /**
     * Run certbot for DNSPod domains via the canonical builder. $sudo prefixes
     * the call with sudo (web/API context where the PHP process is not root).
     */
    public static function runDNSPodCertbot(array $domains, array $extraArgs = [], ?int $timeout = null, bool $sudo = false): array
    {
        $command = self::buildDNSPodCertbotCommand($domains, $extraArgs);
        if ($command === null) {
            return [
                'success' => false,
                'output' => '',
                'error' => 'DNSPod credentials unavailable or credentials file not writable',
                'exit_code' => 1,
            ];
        }

        if ($sudo) {
            return ServerManagerV1Utils::executeCommand('sudo', array_merge(['certbot'], $command), $timeout);
        }
        return ServerManagerV1Utils::executeCommand('certbot', $command, $timeout);
    }

    /**
     * Get certificates database file path
     */
    private static function getCertificatesFilePath(): string
    {
        return self::getCertificatesDbDir() . '/' . self::CERTIFICATES_FILE;
    }
    
    /**
     * Ensure database directory exists
     */
    private static function ensureDbDirectory(): bool
    {
        $dbDir = self::getCertificatesDbDir();
        if (!is_dir($dbDir)) {
            if (!mkdir($dbDir, 0755, true)) {
                Log::error('Failed to create certificates database directory: ' . $dbDir);
                return false;
            }
        }
        return true;
    }
    
    /**
     * Load certificates from JSON file
     */
    private static function loadCertificates(): array
    {
        $filePath = self::getCertificatesFilePath();
        
        if (!file_exists($filePath)) {
            return [];
        }
        
        $content = file_get_contents($filePath);
        if ($content === false) {
            Log::error('Failed to read certificates file: ' . $filePath);
            return [];
        }
        
        $data = json_decode($content, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            Log::error('Invalid JSON in certificates file: ' . json_last_error_msg());
            return [];
        }
        
        return $data['certificates'] ?? [];
    }
    
    /**
     * Save certificates to JSON file
     */
    private static function saveCertificates(array $certificates): bool
    {
        if (!self::ensureDbDirectory()) {
            return false;
        }
        
        $data = [
            'version' => '1.0',
            'updated_at' => date('Y-m-d H:i:s'),
            'certificates' => $certificates
        ];
        
        $filePath = self::getCertificatesFilePath();
        $content = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        
        if (file_put_contents($filePath, $content) === false) {
            Log::error('Failed to save certificates file: ' . $filePath);
            return false;
        }
        
        return true;
    }
    
    /**
     * Generate expanded domain list for a base domain (single implementation:
     * ServerManagerV1DomainExpander).
     */
    public static function generateExpandedDomains(string $baseDomain): array
    {
        return ServerManagerV1DomainExpander::expand($baseDomain);
    }
    
    /**
     * Find existing certificate that covers a domain
     */
    public static function findCertificateForDomain(string $domain): ?array
    {
        $certificates = self::loadCertificates();
        
        foreach ($certificates as $certId => $cert) {
            if (ServerManagerV1DomainExpander::covers($domain, $cert['domains'])) {
                return $cert;
            }
        }
        
        return null;
    }
    
    /**
     * Add or update certificate
     */
    public static function addCertificate(string $baseDomain, array $certificateData): bool
    {
        $certificates = self::loadCertificates();

        // Use custom domains if provided, otherwise generate expanded domains
        $domains = $certificateData['domains'] ?? self::generateExpandedDomains($baseDomain);

        $certId = "cert_" . str_replace('.', '_', $baseDomain);

        $certificate = [
            'id' => $certId,
            'base_domain' => $baseDomain,
            'domains' => $domains,
            'certificate_path' => ServerManagerV1PathConfig::getLetsEncryptLiveDir($baseDomain) . '/',
            'provider' => $certificateData['provider'] ?? 'dnspod',
            'status' => $certificateData['status'] ?? 'pending',
            'issued_at' => $certificateData['issued_at'] ?? null,
            'expires_at' => $certificateData['expires_at'] ?? null,
            'auto_renew' => $certificateData['auto_renew'] ?? true,
            'created_at' => $certificateData['created_at'] ?? date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
            'generation_attempts' => $certificateData['generation_attempts'] ?? 0,
            'last_error' => $certificateData['last_error'] ?? null
        ];

        $certificates[$certId] = $certificate;

        if (self::saveCertificates($certificates)) {
            Log::info('Certificate added/updated successfully', ['base_domain' => $baseDomain, 'cert_id' => $certId]);
            return true;
        }

        return false;
    }
    
    /**
     * Update certificate status
     */
    public static function updateCertificateStatus(string $baseDomain, string $status, array $additionalData = []): bool
    {
        $certificates = self::loadCertificates();
        $certId = "cert_" . str_replace('.', '_', $baseDomain);
        
        if (!isset($certificates[$certId])) {
            Log::error('Certificate not found for status update', ['base_domain' => $baseDomain]);
            return false;
        }
        
        $certificates[$certId]['status'] = $status;
        $certificates[$certId]['updated_at'] = date('Y-m-d H:i:s');
        
        // Update additional data
        foreach ($additionalData as $key => $value) {
            $certificates[$certId][$key] = $value;
        }
        
        return self::saveCertificates($certificates);
    }
    
    /**
     * Check if domain needs certificate expansion
     */
    public static function needsCertificateExpansion(string $newDomain): ?array
    {
        $certificates = self::loadCertificates();
        
        // Extract base domain from new domain
        $domainParts = explode('.', $newDomain);
        $possibleBaseDomains = [];
        
        // Generate possible base domains (e.g., for a.new.example.com -> new.example.com, example.com)
        for ($i = 1; $i < count($domainParts); $i++) {
            $possibleBaseDomains[] = implode('.', array_slice($domainParts, $i));
        }
        
        foreach ($possibleBaseDomains as $baseDomain) {
            $certId = "cert_" . str_replace('.', '_', $baseDomain);
            if (isset($certificates[$certId])) {
                $cert = $certificates[$certId];
                if (!ServerManagerV1DomainExpander::covers($newDomain, $cert['domains'])) {
                    // Need to expand certificate
                    return [
                        'certificate' => $cert,
                        'expansion_needed' => true,
                        'new_base_domain' => self::calculateNewBaseDomain($newDomain, $baseDomain)
                    ];
                }
            }
        }
        
        return null;
    }
    
    /**
     * Calculate new base domain for certificate expansion
     */
    private static function calculateNewBaseDomain(string $newDomain, string $currentBaseDomain): string
    {
        $newParts = explode('.', $newDomain);
        $currentParts = explode('.', $currentBaseDomain);
        
        // Find the common suffix
        $commonSuffixLength = 0;
        for ($i = 1; $i <= min(count($newParts), count($currentParts)); $i++) {
            if ($newParts[count($newParts) - $i] === $currentParts[count($currentParts) - $i]) {
                $commonSuffixLength = $i;
            } else {
                break;
            }
        }
        
        // Return the domain that covers both
        if ($commonSuffixLength > 0) {
            return implode('.', array_slice($newParts, count($newParts) - $commonSuffixLength));
        }
        
        return $currentBaseDomain;
    }
    
    /**
     * Get all certificates
     */
    public static function getAllCertificates(): array
    {
        return self::loadCertificates();
    }
    
    /**
     * Get certificate by base domain
     */
    public static function getCertificate(string $baseDomain): ?array
    {
        $certificates = self::loadCertificates();
        $certId = "cert_" . str_replace('.', '_', $baseDomain);
        
        return $certificates[$certId] ?? null;
    }
    
    /**
     * Get certificates summary for display
     */
    public static function getCertificatesSummary(): array
    {
        $certificates = self::loadCertificates();
        $summary = [
            'total_certificates' => count($certificates),
            'active_certificates' => 0,
            'expired_certificates' => 0,
            'expiring_soon' => 0,
            'certificates' => []
        ];

        $now = time();
        $soonThreshold = $now + (30 * 24 * 60 * 60); // 30 days

        foreach ($certificates as $cert) {
            $expiresAt = $cert['expires_at'] ? strtotime($cert['expires_at']) : null;
            $expiresAtDisplay = $cert['expires_at'];
            if ($expiresAt === null) {
                // The store snapshot may predate expiry tracking; the live
                // certificate on disk is the authority.
                $liveExpiry = self::liveCertExpiryTimestamp((string) $cert['base_domain']);
                if ($liveExpiry !== null) {
                    $expiresAt = $liveExpiry;
                    $expiresAtDisplay = date('Y-m-d H:i:s', $liveExpiry);
                }
            }

            if ($cert['status'] === 'active') {
                $summary['active_certificates']++;
            }

            if ($expiresAt) {
                if ($expiresAt < $now) {
                    $summary['expired_certificates']++;
                } elseif ($expiresAt < $soonThreshold) {
                    $summary['expiring_soon']++;
                }
            }

            $summary['certificates'][] = [
                'id' => $cert['id'],
                'base_domain' => $cert['base_domain'],
                'status' => $cert['status'],
                'expires_at' => $expiresAtDisplay,
                'domain_count' => count($cert['domains']),
                'domains' => array_values($cert['domains']),
                'auto_renew' => $cert['auto_renew']
            ];
        }

        return $summary;
    }

    /**
     * Renew all certificates that are expiring soon or expired
     *
     * @param int $daysThreshold Days before expiry to trigger renewal (default: 30)
     * @return array Summary of renewal operations
     */
    public static function renewAllCertificates(int $daysThreshold = 30): array
    {
        $certificates = self::loadCertificates();
        $result = [
            'total' => 0,
            'renewed' => 0,
            'skipped' => 0,
            'failed' => 0,
            'details' => []
        ];

        $now = time();
        $renewThreshold = $now + ($daysThreshold * 24 * 60 * 60);

        foreach ($certificates as $certId => $cert) {
            $result['total']++;
            $baseDomain = $cert['base_domain'];

            // Skip if auto_renew is disabled
            if (!($cert['auto_renew'] ?? true)) {
                $result['skipped']++;
                $result['details'][] = [
                    'domain' => $baseDomain,
                    'status' => 'skipped',
                    'reason' => 'Auto-renew disabled'
                ];
                continue;
            }

            // Check expiry
            $expiresAt = $cert['expires_at'] ? strtotime($cert['expires_at']) : null;

            if (!$expiresAt || $expiresAt > $renewThreshold) {
                $daysLeft = $expiresAt ? (int)(($expiresAt - $now) / (24 * 60 * 60)) : 0;
                $result['skipped']++;
                $result['details'][] = [
                    'domain' => $baseDomain,
                    'status' => 'skipped',
                    'reason' => "Certificate valid for $daysLeft more days"
                ];
                continue;
            }

            // Certificate needs renewal
            Log::info("Attempting to renew certificate for: $baseDomain");

            $result['details'][] = [
                'domain' => $baseDomain,
                'status' => 'attempting',
                'reason' => 'Certificate expiring soon or expired'
            ];

            // Note: Actual renewal implementation should call certbot renew
            // This is a placeholder - the actual implementation should be in the command
            $result['renewed']++;
        }

        return $result;
    }

    /**
     * Expiry timestamp of the live certificate on disk (the same source
     * certbot itself consults). The ServerManager store's expires_at is only
     * a snapshot and may be missing for certificates issued before it was
     * tracked; the PEM on disk is the authority.
     */
    private static function liveCertExpiryTimestamp(string $baseDomain): ?int
    {
        $liveDir = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getLetsEncryptLiveDir($baseDomain);
        $pemFile = $liveDir . '/fullchain.pem';
        if (!is_file($pemFile)) {
            return null;
        }

        $pem = @file_get_contents($pemFile);
        if ($pem === false) {
            return null;
        }

        $parsed = openssl_x509_parse($pem);
        $validTo = $parsed['validTo_time_t'] ?? null;

        return is_int($validTo) ? $validTo : null;
    }

    /**
     * Check all certificates and get list of domains needing renewal
     *
     * @param int $daysThreshold Days before expiry to consider renewal (default: 30)
     * @return array List of domains that need renewal
     */
    public static function getCertificatesNeedingRenewal(int $daysThreshold = 30): array
    {
        $certificates = self::loadCertificates();
        $needingRenewal = [];

        $now = time();
        $renewThreshold = $now + ($daysThreshold * 24 * 60 * 60);

        foreach ($certificates as $cert) {
            // Skip if auto_renew is disabled
            if (!($cert['auto_renew'] ?? true)) {
                continue;
            }

            $expiresAt = $cert['expires_at'] ? strtotime($cert['expires_at']) : null;
            if ($expiresAt === null) {
                $expiresAt = self::liveCertExpiryTimestamp((string) $cert['base_domain']);
            }

            if ($expiresAt && $expiresAt <= $renewThreshold) {
                $daysLeft = (int)(($expiresAt - $now) / (24 * 60 * 60));
                $needingRenewal[] = [
                    'base_domain' => $cert['base_domain'],
                    'expires_at' => $cert['expires_at'] ?: date('Y-m-d H:i:s', $expiresAt),
                    'days_until_expiry' => $daysLeft,
                    'is_expired' => $expiresAt < $now,
                    'domains' => $cert['domains']
                ];
            }
        }

        return $needingRenewal;
    }
}
