<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Controllers;

use App\Apps\ServerManagerV1\ServerManagerV1Gvar\ServerManagerV1Constants;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1Utils;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1SSLConfigReader;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

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
            return $this->success([
                'certificates' => [],
                'total_certificates' => 0,
                'error' => 'Certbot not found. Please install certbot first.'
            ], 'Certbot not installed');
        }

        // Try with sudo first
        $result = ServerManagerV1Utils::executeCommand('sudo', [$certbotPath, 'certificates']);

        // If sudo fails, return empty list with helpful message
        if (!$result['success']) {
            return $this->success([
                'certificates' => [],
                'total_certificates' => 0,
                'error' => 'Cannot access certbot certificates. Permission denied or no certificates found.',
                'raw_error' => $result['error']
            ], 'No certificates available');
        }

        // Parse certbot output
        $certificates = $this->parseCertbotOutput($result['output']);

        return $this->success([
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
            return $this->error('Invalid domain name', 400, ['domain' => $domain]);
        }

        // Cooldown: 5 minutes between generate attempts per domain.
        $cooldownKey = 'cert_cooldown_' . md5(strtolower($domain));
        if (Cache::has($cooldownKey)) {
            $remaining = (int) Cache::ttl($cooldownKey);
            return $this->error("Cooldown active: {$remaining}s remaining before the next attempt for {$domain}.", 429);
        }

        // Get DNS credentials
        $dnsCredentials = $this->getDnsCredentials($provider);
        if (!$dnsCredentials) {
            return $this->error('Failed to retrieve DNS credentials', 400, ['provider' => $provider]);
        }

        $certbotPath = $this->findCertbotBinary();
        $displayCmd = $certbotPath
            ? 'sudo ' . escapeshellcmd($certbotPath) . ' certonly --dns-' . $provider
              . ($staging ? ' --staging' : '')
              . ' --keep-until-expiring -d ' . escapeshellarg($domain)
            : '';

        // Generate certificate using DNS challenge
        $result = $this->generateCertificateWithDns($domain, $provider, $dnsCredentials, $staging);

        if ($result['success']) {
            Cache::put($cooldownKey, time(), 300);
            return $this->success([
                'domain' => $domain,
                'provider' => $provider,
                'staging' => $staging,
                'certificate_path' => \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getLetsEncryptLiveDir($domain) . '/',
                'output' => $result['output'],
                'command' => $displayCmd,
            ], 'SSL certificate generated successfully');
        } else {
            return $this->error('Failed to generate SSL certificate', 500, [
                'domain' => $domain,
                'error' => $result['error'],
                'exit_code' => $result['exit_code'],
                'command' => $displayCmd,
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
            return $this->error('Certbot not found. Please install certbot first.', 404);
        }

        // Check current user for diagnostic purposes
        $currentUser = posix_getpwuid(posix_geteuid());

        // List all certificates first
        $listCmd = $certbotPath . ' certificates 2>&1';
        exec($listCmd, $listOutput, $listCode);

        // If no certificates found, return early with helpful message
        if ($listCode !== 0 || empty($listOutput) || strpos(implode("\n", $listOutput), 'No certificates found') !== false) {
            // When a specific domain was requested and no cert exists, fall
            // through to idempotent generation (--keep-until-expiring) so the
            // "renew" button also doubles as "generate when missing".
            if ($domain && !$all) {
                $certRequest = new \Illuminate\Http\Request([
                    'domain' => $domain,
                    'provider' => 'dnspod',
                    'staging' => false,
                ]);
                return $this->generateCertificate($certRequest);
            }
            return $this->success([
                'renewed' => 0,
                'certificates' => [],
                'message' => 'No certificates found to renew',
                'current_user' => $currentUser['name']
            ], 'No certificates to renew');
        }

        // Try with --dry-run first to check if renewal would work
        $dryRunCmd = $certbotPath . ' renew --dry-run --no-random-sleep-on-renew 2>&1';
        exec($dryRunCmd, $dryRunOutput, $dryRunCode);
        $dryRunResult = implode("\n", $dryRunOutput);

        // If dry-run fails with filesystem error, return informative message
        if (strpos($dryRunResult, 'Read-only file system') !== false ||
            strpos($dryRunResult, '.certbot.lock') !== false) {

            Log::warning('ServerManagerV1: Certbot renewal blocked by filesystem restrictions', [
                'error' => $dryRunResult,
                'current_user' => $currentUser['name'],
                'uid' => posix_geteuid()
            ]);

            return $this->error(
                'Certificate renewal is currently unavailable due to system restrictions. Please run certbot manually as root or check system logs.',
                503,
                [
                    'diagnostic' => 'Filesystem restrictions prevent certbot from creating lock files',
                    'suggestion' => 'Run manually: sudo certbot renew',
                    'current_user' => $currentUser['name'],
                    'certbot_path' => $certbotPath,
                    'error_detail' => $dryRunResult
                ]
            );
        }

        // If dry-run shows no renewal needed, return success
        if (strpos($dryRunResult, 'No renewals were attempted') !== false ||
            strpos($dryRunResult, 'not yet due for renewal') !== false) {
            return $this->success([
                'renewed' => 0,
                'message' => 'All certificates are up to date. No renewal needed.',
                'next_check' => 'Certificates will be checked again in 30 days',
                'dry_run_output' => $dryRunResult
            ], 'No certificates need renewal');
        }

        // If dry-run succeeded, proceed with actual renewal
        $cmd = $certbotPath . ' renew --no-random-sleep-on-renew --non-interactive 2>&1';
        if (!$all && $domain) {
            $cmd = $certbotPath . ' renew --cert-name ' . escapeshellarg($domain) . ' --non-interactive 2>&1';
        }

        exec($cmd, $output, $exitCode);

        $result = [
            'success' => $exitCode === 0,
            'output' => implode("\n", $output),
            'error' => $exitCode !== 0 ? implode("\n", $output) : '',
            'exit_code' => $exitCode,
            'current_user' => $currentUser['name']
        ];

        if ($result['success']) {
            // Reload nginx after successful renewal
            $reloadResult = ServerManagerV1Utils::executeCommand('sudo', ['nginx', '-s', 'reload']);

            Log::info('ServerManagerV1: Certificate renewal completed', [
                'domain' => $domain,
                'all' => $all,
                'nginx_reloaded' => $reloadResult['success']
            ]);

            return $this->success([
                'domain' => $domain,
                'all' => $all,
                'nginx_reloaded' => $reloadResult['success'],
                'output' => $result['output']
            ], 'Certificate renewal completed successfully');
        } else {
            Log::error('ServerManagerV1: Certificate renewal failed', [
                'domain' => $domain,
                'all' => $all,
                'error' => $result['error'],
                'exit_code' => $result['exit_code']
            ]);

            return $this->error('Certificate renewal failed', 500, [
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
            return $this->error('Certificate not found', 404, ['domain' => $domain, 'path' => $certPath]);
        }

        // Get certificate information
        $result = ServerManagerV1Utils::executeCommand('openssl', [
            'x509', '-in', $certPath, '-text', '-noout'
        ]);

        if (!$result['success']) {
            return $this->error('Failed to read certificate', 500, ['error' => $result['error']]);
        }

        $certInfo = $this->parseCertificateInfo($result['output']);
        $certInfo['domain'] = $domain;
        $certInfo['certificate_path'] = $certPath;
        $certInfo['private_key_path'] = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getLetsEncryptKeyPath($domain);
        $certInfo['chain_path'] = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getLetsEncryptChainPath($domain);

        return $this->success($certInfo, 'Certificate status retrieved successfully');
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

        return $this->success([
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
            return $this->success($info, 'Certbot check skipped - Nginx not installed');
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

        return $this->success($info, $installed ? 'Certbot is installed' : 'Certbot is not installed');
    }
    
    /**
     * Get DNS credentials for provider
     */
    private function getDnsCredentials(string $provider): ?array
    {
        try {
            if ($provider === 'dnspod') {
                $email = \App\Utils\SecretStore::get('DNS_DNSPOD_EMAILS');
                $apiToken = \App\Utils\SecretStore::get('DNS_DNSPOD_API_TOKENS');

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
            return [
                'success' => false,
                'error' => 'Certbot not found. Please install certbot first.',
                'exit_code' => 1
            ];
        }

        $command = ['certonly', '--dns-' . $provider];

        if ($staging) {
            $command[] = '--staging';
        }

        $command = array_merge($command, [
            '--email', $credentials['email'],
            '--agree-tos',
            '--non-interactive',
            // Idempotent: if a matching cert already exists and is not near
            // expiry, keep it and take no action (safe to re-run on every site
            // create). Without this, re-issuing over an existing cert errors.
            '--keep-until-expiring',
            '-d', $domain
        ]);

        // Set environment variables for DNS provider
        $env = [];
        if ($provider === 'dnspod') {
            $credFile = $this->createDnspodCredentialsFile($credentials);
            $env['CERTBOT_DNS_DNSPOD_CREDENTIALS'] = $credFile;
            $command[] = '--dns-dnspod-credentials';
            $command[] = $credFile;
        }

        // Execute certbot with sudo
        $fullCommand = array_merge([$certbotPath], $command);
        return ServerManagerV1Utils::executeCommand('sudo', $fullCommand, 300, $env);
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

    // ------------------------------------------------------------------
    // Idempotent ensure + async progress
    // ------------------------------------------------------------------

    /**
     * POST /api/servermanager/v1/certificates/ensure
     *
     * Idempotent: generates a new cert (DNS challenge, --keep-until-expiring) when
     * none exists for the domain, or renews when one does. A 5-minute cooldown per
     * domain prevents rapid-fire retries. Runs certbot asynchronously via a
     * backgrounded shell so the HTTP response returns immediately; the FE polls
     * GET /certificates/progress/{request_id} for real-time output.
     */
    public function ensureCertificate(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'certificate_ensure');
        if ($validation) {
            return $validation;
        }

        $domain = $request->input('domain');
        $provider = $request->input('provider', 'dnspod');
        $staging = (bool) $request->input('staging', false);

        if (empty($domain) || !preg_match('/^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/', $domain)) {
            return $this->error('Invalid domain name', 400);
        }

        // Cooldown: 5 minutes between attempts per domain (prevents rate-limit
        // exhaustion + rapid retry loops).
        $cooldownKey = 'cert_cooldown_' . md5(strtolower($domain));
        if (Cache::has($cooldownKey)) {
            $remaining = (int) Cache::ttl($cooldownKey);
            return $this->error(
                "Cooldown active: {$remaining}s remaining before the next attempt for {$domain}.",
                429
            );
        }

        $certbotPath = $this->findCertbotBinary();
        if ($certbotPath === null) {
            return $this->error('Certbot not found.', 404);
        }

        $certPath = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getLetsEncryptCertPath($domain);
        $certExists = file_exists($certPath);
        $requestId = 'cert_' . uniqid('', true);
        $outputFile = sys_get_temp_dir() . '/' . $requestId . '.log';

        // Build the certbot command (backslashed for shell back-grounding).
        if ($certExists) {
            $shellCmd = escapeshellcmd($certbotPath)
                . ' renew --cert-name ' . escapeshellarg($domain)
                . ' --non-interactive --no-random-sleep-on-renew';
        } else {
            $dnsCredentials = $this->getDnsCredentials($provider);
            if (!$dnsCredentials) {
                return $this->error('Failed to retrieve DNS credentials for ' . $provider, 400);
            }
            $credFile = $this->createDnspodCredentialsFile($dnsCredentials);
            $shellCmd = escapeshellcmd($certbotPath)
                . ' certonly --dns-' . $provider
                . ($staging ? ' --staging' : '')
                . ' --email ' . escapeshellarg($dnsCredentials['email'])
                . ' --agree-tos --non-interactive --keep-until-expiring'
                . ' -d ' . escapeshellarg($domain)
                . ' --dns-dnspod-credentials ' . escapeshellarg($credFile);
        }

        $displayCmd = ($certExists ? 'sudo certbot renew --cert-name ' . $domain : 'sudo certbot certonly --dns-' . $provider . ' ... -d ' . $domain);

        // Start certbot in the background: redirect stdout+stderr to the output
        // file, append a __DONE__ sentinel on exit so the polling endpoint detects
        // completion, then detach via &. exec() returns immediately.
        $fullShell = $shellCmd
            . ' > ' . escapeshellarg($outputFile) . ' 2>&1'
            . '; echo "\n__DONE__\n" >> ' . escapeshellarg($outputFile);
        exec("nohup sh -c " . escapeshellarg($fullShell) . ' > /dev/null 2>&1 &');

        Cache::put("cert_progress_{$requestId}", [
            'request_id' => $requestId,
            'domain' => strtolower($domain),
            'command' => $displayCmd,
            'output_file' => $outputFile,
            'status' => 'running',
            'started_at' => now()->toIso8601String(),
            'cert_exists' => $certExists,
        ], 600);

        // Set cooldown.
        Cache::put($cooldownKey, time(), 300);

        Log::info('ServerManagerV1: Cert ensure started', [
            'request_id' => $requestId,
            'domain' => $domain,
            'cert_exists' => $certExists,
        ]);

        return $this->success([
            'request_id' => $requestId,
            'command' => $displayCmd,
            'status' => 'running',
            'cert_exists' => $certExists,
        ], $certExists ? 'Certificate renewal started' : 'Certificate generation started');
    }

    /**
     * GET /api/servermanager/v1/certificates/progress/{request_id}
     *
     * Poll the real-time output of a backgrounded certbot ensure/generate/renew
     * operation. Returns the accumulated output lines, the command string, and
     * a status field: 'running' (output still being written) or 'completed'
     * (__DONE__ sentinel found). The cache entry expires after 10 minutes.
     */
    public function certificateProgress(Request $request, string $requestId): JsonResponse
    {
        $meta = Cache::get("cert_progress_{$requestId}");
        if (!$meta || !is_array($meta)) {
            return $this->error('Request not found or expired.', 404, ['request_id' => $requestId]);
        }

        $outputFile = $meta['output_file'] ?? '';
        $output = '';
        $status = $meta['status'] ?? 'running';

        if ($outputFile !== '' && file_exists($outputFile)) {
            $output = @file_get_contents($outputFile) ?: '';
            if ($output === false) {
                $output = '';
            }
            // Detect the __DONE__ sentinel that the background shell appends on exit.
            if (strpos($output, '__DONE__') !== false) {
                $output = trim(str_replace('__DONE__', '', $output));
                $status = 'completed';
                $meta['status'] = 'completed';
                $meta['output'] = $output;
                Cache::put("cert_progress_{$requestId}", $meta, 600);
            }
        } else {
            $output = $meta['output'] ?? '';
        }

        $lines = $output !== '' ? array_values(array_filter(explode("\n", $output), function ($l) {
            $t = trim($l);
            return $t !== '' && $t !== '__DONE__';
        })) : [];

        return $this->success([
            'request_id' => $requestId,
            'command' => $meta['command'] ?? '',
            'status' => $status,
            'output' => $output,
            'output_lines' => $lines,
            'started_at' => $meta['started_at'] ?? null,
        ], 'Progress retrieved');
    }

    /** @return string|null certbot binary path or null */
    private function findCertbotBinary(): ?string
    {
        foreach (['/usr/bin/certbot','/usr/local/bin/certbot','/usr/sbin/certbot','/sbin/certbot'] as $p) {
            if (file_exists($p) && is_executable($p)) return $p;
        }
        $which = ServerManagerV1Utils::executeCommand('which', ['certbot']);
        if ($which['success'] && trim($which['output'])) return trim($which['output']);
        return null;
    }
}
