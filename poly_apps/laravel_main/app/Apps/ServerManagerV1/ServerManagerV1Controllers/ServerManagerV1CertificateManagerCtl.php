<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Controllers;

use App\Apps\ServerManagerV1\ServerManagerV1Gvar\ServerManagerV1Constants;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1Utils;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1SSLConfigReader;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Artisan;

class ServerManagerV1CertificateManagerCtl extends ServerManagerV1BaseCtl
{
    /**
     * List all SSL certificates
     */
    public function listCertificates(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'certificate_list');
        if ($validation) {
            return $validation;
        }

        // Find certbot binary using absolute paths
        $certbotPaths = [
            '/usr/bin/certbot',
            '/usr/local/bin/certbot',
            '/usr/sbin/certbot',
            '/sbin/certbot'
        ];

        $certbotPath = null;
        foreach ($certbotPaths as $path) {
            if (file_exists($path) && is_executable($path)) {
                $certbotPath = $path;
                break;
            }
        }

        // Fallback to which command
        if (!$certbotPath) {
            $whichResult = ServerManagerV1Utils::executeCommand('which', ['certbot']);
            if ($whichResult['success']) {
                $certbotPath = trim($whichResult['output']);
            }
        }

        if (!$certbotPath) {
            return $this->successResponse([
                'certificates' => [],
                'total_certificates' => 0,
                'error' => 'Certbot not found. Please install certbot first.'
            ], 'Certbot not installed');
        }

        // Try with sudo first
        $result = ServerManagerV1Utils::executeCommand('sudo', [$certbotPath, 'certificates']);

        // If sudo fails, return empty list with helpful message
        if (!$result['success']) {
            return $this->successResponse([
                'certificates' => [],
                'total_certificates' => 0,
                'error' => 'Cannot access certbot certificates. Permission denied or no certificates found.',
                'raw_error' => $result['error']
            ], 'No certificates available');
        }

        // Parse certbot output
        $certificates = $this->parseCertbotOutput($result['output']);

        return $this->successResponse([
            'certificates' => $certificates,
            'total_certificates' => count($certificates),
            'raw_output' => $result['output']
        ], 'Certificate list retrieved successfully');
    }
    
    /**
     * Generate SSL certificate for domain
     */
    public function generateCertificate(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'certificate_generate');
        if ($validation) {
            return $validation;
        }

        $paramValidation = $this->validateParameters($request, ['domain']);
        if ($paramValidation) {
            return $paramValidation;
        }

        $domain = $request->input('domain');
        $provider = $request->input('provider', 'dnspod');
        $staging = $request->input('staging', false);

        // Validate domain
        if (!filter_var($domain, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME)) {
            return $this->errorResponse('Invalid domain name', 400, ['domain' => $domain]);
        }

        // Get DNS credentials
        $dnsCredentials = $this->getDnsCredentials($provider);
        if (!$dnsCredentials) {
            return $this->errorResponse('Failed to retrieve DNS credentials', 400, ['provider' => $provider]);
        }

        // Generate certificate using DNS challenge
        $result = $this->generateCertificateWithDns($domain, $provider, $dnsCredentials, $staging);

        if ($result['success']) {
            return $this->successResponse([
                'domain' => $domain,
                'provider' => $provider,
                'staging' => $staging,
                'certificate_path' => \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getLetsEncryptLiveDir($domain) . '/',
                'output' => $result['output']
            ], 'SSL certificate generated successfully');
        } else {
            return $this->errorResponse('Failed to generate SSL certificate', 500, [
                'domain' => $domain,
                'error' => $result['error'],
                'exit_code' => $result['exit_code']
            ]);
        }
    }
    
    /**
     * Renew SSL certificates
     */
    public function renewCertificates(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'certificate_renew');
        if ($validation) {
            return $validation;
        }

        $domain = $request->input('domain');
        $all = $request->input('all', false);

        if ($all) {
            $result = ServerManagerV1Utils::executeCommand('certbot', ['renew', '--quiet']);
        } elseif ($domain) {
            $result = ServerManagerV1Utils::executeCommand('certbot', ['renew', '--cert-name', $domain, '--quiet']);
        } else {
            return $this->errorResponse('Either domain or all parameter is required', 400);
        }

        if ($result['success']) {
            // Reload nginx after successful renewal
            $reloadResult = ServerManagerV1Utils::executeCommand('nginx', ['-s', 'reload']);

            return $this->successResponse([
                'domain' => $domain,
                'all' => $all,
                'nginx_reloaded' => $reloadResult['success'],
                'output' => $result['output']
            ], 'Certificate renewal completed successfully');
        } else {
            return $this->errorResponse('Certificate renewal failed', 500, [
                'error' => $result['error'],
                'exit_code' => $result['exit_code']
            ]);
        }
    }
    
    /**
     * Get certificate status
     */
    public function getCertificateStatus(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'certificate_status');
        if ($validation) {
            return $validation;
        }

        $paramValidation = $this->validateParameters($request, ['domain']);
        if ($paramValidation) {
            return $paramValidation;
        }

        $domain = $request->input('domain');
        $certPath = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getLetsEncryptCertPath($domain);

        if (!file_exists($certPath)) {
            return $this->errorResponse('Certificate not found', 404, ['domain' => $domain, 'path' => $certPath]);
        }

        // Get certificate information
        $result = ServerManagerV1Utils::executeCommand('openssl', [
            'x509', '-in', $certPath, '-text', '-noout'
        ]);

        if (!$result['success']) {
            return $this->errorResponse('Failed to read certificate', 500, ['error' => $result['error']]);
        }

        $certInfo = $this->parseCertificateInfo($result['output']);
        $certInfo['domain'] = $domain;
        $certInfo['certificate_path'] = $certPath;
        $certInfo['private_key_path'] = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getLetsEncryptKeyPath($domain);
        $certInfo['chain_path'] = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getLetsEncryptChainPath($domain);

        return $this->successResponse($certInfo, 'Certificate status retrieved successfully');
    }
    
    /**
     * Install certbot (check if needed)
     */
    public function installCertbot(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'certbot_install');
        if ($validation) {
            return $validation;
        }

        // Run the check certbot command
        $exitCode = Artisan::call('servermanager:check-certbot', ['--install' => true]);

        $output = Artisan::output();

        return $this->successResponse([
            'exit_code' => $exitCode,
            'output' => $output,
            'installed' => $exitCode === 0
        ], $exitCode === 0 ? 'Certbot installation completed' : 'Certbot installation failed');
    }
    
    /**
     * Detect certbot installation
     */
    public function detectCertbot(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'certbot_detect');
        if ($validation) {
            return $validation;
        }

        // Check nginx using absolute paths (same as sh script logic)
        $nginxPaths = [
            '/usr/sbin/nginx',
            '/usr/bin/nginx',
            '/sbin/nginx',
            '/usr/local/sbin/nginx',
            '/usr/local/bin/nginx'
        ];

        $nginxInstalled = false;
        $nginxPath = null;

        foreach ($nginxPaths as $path) {
            if (file_exists($path) && is_executable($path)) {
                $nginxInstalled = true;
                $nginxPath = $path;
                break;
            }
        }

        // Fallback to which command
        if (!$nginxInstalled) {
            $nginxResult = ServerManagerV1Utils::executeCommand('which', ['nginx']);
            if ($nginxResult['success']) {
                $nginxInstalled = true;
                $nginxPath = trim($nginxResult['output']);
            }
        }

        $info = [
            'nginx_installed' => $nginxInstalled,
            'nginx_path' => $nginxPath,
            'installed' => false,
            'path' => null,
            'skip_reason' => null
        ];

        // If nginx not installed, skip certbot check (same as sh script)
        if (!$nginxInstalled) {
            $info['skip_reason'] = 'Nginx is not installed - Certbot requires Nginx';
            return $this->successResponse($info, 'Certbot check skipped - Nginx not installed');
        }

        // Check certbot using absolute paths
        $certbotPaths = [
            '/usr/bin/certbot',
            '/usr/local/bin/certbot',
            '/usr/sbin/certbot',
            '/sbin/certbot'
        ];

        $installed = false;
        $certbotPath = null;

        foreach ($certbotPaths as $path) {
            if (file_exists($path) && is_executable($path)) {
                $installed = true;
                $certbotPath = $path;
                break;
            }
        }

        // Fallback to which command
        if (!$installed) {
            $result = ServerManagerV1Utils::executeCommand('which', ['certbot']);
            if ($result['success']) {
                $installed = true;
                $certbotPath = trim($result['output']);
            }
        }

        $info['installed'] = $installed;
        $info['path'] = $certbotPath;

        if ($installed) {
            // Get version
            $versionResult = ServerManagerV1Utils::executeCommand($certbotPath, ['--version']);
            if ($versionResult['success']) {
                $info['version'] = trim($versionResult['output']);
            }

            // Check nginx plugin
            $pluginResult = ServerManagerV1Utils::executeCommand($certbotPath, ['plugins']);
            $info['nginx_plugin'] = $pluginResult['success'] && strpos($pluginResult['output'], 'nginx') !== false;
        }

        return $this->successResponse($info, $installed ? 'Certbot is installed' : 'Certbot is not installed');
    }
    
    /**
     * Get DNS credentials for provider
     */
    private function getDnsCredentials(string $provider): ?array
    {
        try {
            if ($provider === 'dnspod') {
                $email = \App\Helpers\GlobalSecretReader::getSecretContent('DNS_DNSPOD_EMAILS');
                $apiToken = \App\Helpers\GlobalSecretReader::getSecretContent('DNS_DNSPOD_API_TOKENS');

                if ($email && $apiToken) {
                    // Parse DNSPod API token format: "id,token"
                    $tokenParts = explode(',', $apiToken, 2);
                    if (count($tokenParts) === 2) {
                        return [
                            'email' => $email,
                            'api_id' => trim($tokenParts[0]),
                            'api_token' => trim($tokenParts[1]),
                            'token' => $apiToken // Keep original format for backward compatibility
                        ];
                    } else {
                        Log::error('Invalid DNSPod API token format. Expected: "id,token"', ['token' => $apiToken]);
                        return null;
                    }
                }
            }

            return null;
        } catch (\Exception $e) {
            Log::error('Failed to get DNS credentials', ['provider' => $provider, 'error' => $e->getMessage()]);
            return null;
        }
    }
    
    /**
     * Generate certificate using DNS challenge
     */
    private function generateCertificateWithDns(string $domain, string $provider, array $credentials, bool $staging): array
    {
        $command = ['certonly', '--dns-' . $provider];
        
        if ($staging) {
            $command[] = '--staging';
        }
        
        $command = array_merge($command, [
            '--email', $credentials['email'],
            '--agree-tos',
            '--non-interactive',
            '-d', $domain
        ]);
        
        // Set environment variables for DNS provider
        $env = [];
        if ($provider === 'dnspod') {
            $env['CERTBOT_DNS_DNSPOD_CREDENTIALS'] = $this->createDnspodCredentialsFile($credentials);
        }
        
        return ServerManagerV1Utils::executeCommand('certbot', $command, 300, $env);
    }
    
    /**
     * Create temporary credentials file for DNSPod
     */
    private function createDnspodCredentialsFile(array $credentials): string
    {
        $tempFile = tempnam(sys_get_temp_dir(), 'dnspod_credentials_');
        // Standard dns-dnspod plugin requires email and api-token (full "id,token" format)
        // certbot automatically prefixes with "dns_dnspod_" for the credentials file
        // Use quotes to prevent configobj from parsing comma-separated value as a list
        $apiToken = $credentials['api_id'] . ',' . $credentials['api_token'];
        $content = "dns_dnspod_email = {$credentials['email']}\n";
        $content .= "dns_dnspod_api_token = \"{$apiToken}\"\n";

        file_put_contents($tempFile, $content);
        chmod($tempFile, 0600);

        return $tempFile;
    }
    
    /**
     * Parse certbot certificates output
     */
    private function parseCertbotOutput(string $output): array
    {
        $certificates = [];
        $lines = explode("\n", $output);
        $currentCert = null;
        
        foreach ($lines as $line) {
            $line = trim($line);
            
            if (strpos($line, 'Certificate Name:') === 0) {
                if ($currentCert) {
                    $certificates[] = $currentCert;
                }
                $currentCert = ['name' => trim(substr($line, 17))];
            } elseif ($currentCert && strpos($line, 'Domains:') === 0) {
                $currentCert['domains'] = array_map('trim', explode(' ', trim(substr($line, 8))));
            } elseif ($currentCert && strpos($line, 'Expiry Date:') === 0) {
                $currentCert['expiry_date'] = trim(substr($line, 12));
            } elseif ($currentCert && strpos($line, 'Certificate Path:') === 0) {
                $currentCert['certificate_path'] = trim(substr($line, 17));
            } elseif ($currentCert && strpos($line, 'Private Key Path:') === 0) {
                $currentCert['private_key_path'] = trim(substr($line, 17));
            }
        }
        
        if ($currentCert) {
            $certificates[] = $currentCert;
        }
        
        return $certificates;
    }
    
    /**
     * Parse certificate information from openssl output
     */
    private function parseCertificateInfo(string $output): array
    {
        $info = [];
        
        // Extract expiry date
        if (preg_match('/Not After : (.+)/', $output, $matches)) {
            $expiryDate = trim($matches[1]);
            $info['expiry_date'] = $expiryDate;
            
            $expiryTimestamp = strtotime($expiryDate);
            $daysUntilExpiry = ceil(($expiryTimestamp - time()) / 86400);
            $info['days_until_expiry'] = $daysUntilExpiry;
            $info['status'] = $daysUntilExpiry > 30 ? 'ok' : ($daysUntilExpiry > 7 ? 'warning' : 'critical');
        }
        
        // Extract issuer
        if (preg_match('/Issuer: (.+)/', $output, $matches)) {
            $info['issuer'] = trim($matches[1]);
        }
        
        // Extract subject
        if (preg_match('/Subject: (.+)/', $output, $matches)) {
            $info['subject'] = trim($matches[1]);
        }
        
        return $info;
    }
}
