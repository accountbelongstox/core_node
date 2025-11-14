<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use Illuminate\Support\Facades\Log;
use App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig;
use App\Providers\PathMapper;

/**
 * Certificate Management Utility for ServerManagerV1
 * 
 * Manages SSL certificates with wildcard support and subdomain expansion
 */
class ServerManagerV1CertificateManager
{
    // Use PathMapper for database directory
    private const CERTIFICATES_FILE = 'certificates.json';
    
    // Predefined subdomain prefixes
    private const SUBDOMAIN_PREFIXES = ['si', 'sz', 'local', 'api'];
    
    /**
     * Get certificates database directory
     */
    private static function getCertificatesDbDir(): string
    {
        return PathMapper::mapWebPath('laravel_data_dir') . '/servermanager/certificates';
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
     * Generate expanded domain list for a base domain
     */
    public static function generateExpandedDomains(string $baseDomain): array
    {
        $domains = [
            $baseDomain,           // 12gm.com
            "*.$baseDomain"        // *.12gm.com (covers api.12gm.com, si.12gm.com, etc.)
        ];

        // Add wildcard subdomains for each prefix
        // This covers *.si.12gm.com, *.sz.12gm.com, etc.
        // Note: We don't add specific subdomains like api.12gm.com because *.12gm.com already covers them
        foreach (self::SUBDOMAIN_PREFIXES as $prefix) {
            $subDomain = "$prefix.$baseDomain";
            $domains[] = "*.$subDomain";  // Only add wildcard, not the subdomain itself
        }

        return array_unique($domains);
    }
    
    /**
     * Find existing certificate that covers a domain
     */
    public static function findCertificateForDomain(string $domain): ?array
    {
        $certificates = self::loadCertificates();
        
        foreach ($certificates as $certId => $cert) {
            if (self::domainCoveredByCertificate($domain, $cert['domains'])) {
                return $cert;
            }
        }
        
        return null;
    }
    
    /**
     * Check if a domain is covered by certificate domains
     */
    private static function domainCoveredByCertificate(string $domain, array $certDomains): bool
    {
        // Direct match
        if (in_array($domain, $certDomains)) {
            return true;
        }
        
        // Wildcard match
        $domainParts = explode('.', $domain);
        if (count($domainParts) > 1) {
            $wildcardDomain = '*.' . implode('.', array_slice($domainParts, 1));
            if (in_array($wildcardDomain, $certDomains)) {
                return true;
            }
        }
        
        return false;
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
                if (!self::domainCoveredByCertificate($newDomain, $cert['domains'])) {
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
                'expires_at' => $cert['expires_at'],
                'domain_count' => count($cert['domains']),
                'auto_renew' => $cert['auto_renew']
            ];
        }
        
        return $summary;
    }
}
