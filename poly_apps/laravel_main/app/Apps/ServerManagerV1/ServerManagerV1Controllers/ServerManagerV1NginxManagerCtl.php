<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Controllers;

use App\Apps\ServerManagerV1\ServerManagerV1Gvar\ServerManagerV1Constants;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1Utils;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1SSLConfigReader;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1NginxConfigBuilder;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1NginxInfo;
use App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class ServerManagerV1NginxManagerCtl extends ServerManagerV1BaseCtl
{
    /**
     * Hint shown when nginx is not installed on the host
     */
    private const NGINX_INSTALL_HINT = 'nginx is not installed. Run: bash scripts/shells/linux/debian/install_shells/33_install_nginx.sh (idempotent installer)';

    // SYNC CONTRACT (two ends, one truth): this controller is the Laravel end
    // of nginx lifecycle management (install / repair / service / sites /
    // backups / metrics). The shell end is:
    //   scripts/shells/linux/common/nginx_manager.sh (CLI primitives)
    //   scripts/shells/linux/common/nginx_common.sh (repair + renderers)
    //   scripts/shells/linux/debian/install_shells/33_install_nginx.sh (dd.sh step)
    // Any change to repair semantics, upgrade policy, or service control MUST
    // be applied to both ends in the same change. The UI
    // (http://127.0.0.1:13054/laravel-manager#/server) talks ONLY to this API;
    // initial provisioning runs through the shell end.

    /**
     * Detect the full path of the nginx binary (shared probe).
     */
    private function detectNginxBinary(): ?string
    {
        return ServerManagerV1NginxInfo::getBinary();
    }

    /**
     * Reset the nginx binary cache (used after a fresh install)
     */
    private static function resetNginxBinaryCache(): void
    {
        ServerManagerV1NginxInfo::resetCache();
    }

    /**
     * Get the nginx version string ("1.31.3")
     */
    private function getNginxVersion(string $binary): ?string
    {
        return ServerManagerV1NginxInfo::getVersion();
    }

    /**
     * Run `nginx -t` using the detected binary
     */
    private function runConfigTest(string $binary): array
    {
        // Ensure nginx runtime dirs (log/run) exist BEFORE testing - a missing
        // /var/log/nginx makes `nginx -t` fail with
        // "open() /var/log/nginx/error.log failed (2: No such file or directory)"
        // even when the config is syntactically valid, which then blocks
        // reload/restart. Idempotent.
        $this->ensureNginxRuntimeDirs();
        return ServerManagerV1Utils::executeCommand($binary, ['-t']);
    }

    /**
     * Idempotently ensure nginx runtime directories exist (/var/log/nginx for
     * error/access logs, /run/nginx + /var/run/nginx for the pid). Tries native
     * mkdir first (octane often runs as root); falls back to non-interactive sudo
     * (passwordless sudo is set up by the installer). Never throws.
     *
     * @return array{success: bool, actions: string[]}
     */
    private function ensureNginxRuntimeDirs(): array
    {
        $dirs = ['/var/log/nginx', '/var/run/nginx', '/run/nginx'];
        $actions = [];
        foreach ($dirs as $dir) {
            if (is_dir($dir)) {
                continue;
            }
            if (@mkdir($dir, 0755, true)) {
                $actions[] = "created {$dir}";
                continue;
            }
            $mk = ServerManagerV1Utils::executeCommand('sudo', ['-n', 'mkdir', '-p', $dir]);
            if ($mk['success']) {
                ServerManagerV1Utils::executeCommand('sudo', ['-n', 'chmod', '755', $dir]);
                $actions[] = "created {$dir} (sudo)";
            } else {
                $actions[] = "failed to create {$dir}: " . trim($mk['error'] ?? $mk['output'] ?? '');
            }
        }
        return ['success' => true, 'actions' => $actions];
    }

    /**
     * Parse the broken site-config file path from a `nginx -t` error. nginx emits
     * lines like `nginx: [emerg] ... in /etc/nginx/sites-enabled/foo:12`. Returns
     * the absolute path when it lives under the sites-enabled/sites-available dir
     * (so a main-config error like the missing error.log is NOT mistaken for a
     * site config), else null.
     */
    private function extractBrokenConfigPath(string $error, string $enabledDir, string $availableDir): ?string
    {
        if ($error === '') {
            return null;
        }
        if (!preg_match_all('#(/[^\s:]+)#', $error, $matches)) {
            return null;
        }
        foreach ($matches[1] as $path) {
            $clean = preg_replace('/:\d+$/', '', $path);
            if (($enabledDir !== '' && strpos($clean, $enabledDir) === 0)
                || ($availableDir !== '' && strpos($clean, $availableDir) === 0)) {
                return $clean;
            }
        }
        return null;
    }

    /**
     * Quarantine a broken site config so nginx stops loading it: back up the
     * sites-available file as .broken, then remove the sites-enabled symlink (or
     * the file itself if it is a real file). Idempotent (no error if already
     * gone). Returns true when something was removed.
     */
    private function quarantineSiteConfig(string $path, string $backupDir): bool
    {
        if (!is_link($path) && !file_exists($path)) {
            return false;
        }
        if ($backupDir !== '' && is_dir($backupDir) && is_file($path)) {
            @copy($path, $backupDir . '/' . basename($path) . '.broken.' . date('Y-m-d_H-i-s'));
        }
        return @unlink($path);
    }

    /**
     * Run a service action (start/stop/restart/reload/status) for nginx,
     * preferring systemctl and falling back to `service` when systemd
     * is unavailable (e.g. WSL without systemd).
     *
     * @return array{executed_via: string, result: array}
     */
    private function runServiceAction(string $action): array
    {
        $systemctlCheck = ServerManagerV1Utils::executeCommand('which', ['systemctl']);
        $hasSystemctl = $systemctlCheck['success'] && trim($systemctlCheck['output']) !== '';

        if ($hasSystemctl) {
            $result = ServerManagerV1Utils::executeCommand('systemctl', [$action, 'nginx'], 60);
            $combined = ($result['output'] ?? '') . ' ' . ($result['error'] ?? '');

            $noSystemd = stripos($combined, 'System has not been booted') !== false
                || stripos($combined, 'Failed to connect to bus') !== false;

            if ($result['success'] || !$noSystemd) {
                return ['executed_via' => 'systemctl', 'result' => $result];
            }
        }

        $result = ServerManagerV1Utils::executeCommand('service', ['nginx', $action], 60);
        return ['executed_via' => 'service', 'result' => $result];
    }

    /**
     * List nginx sites
     */
    public function listSites(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'nginx_list_sites');
        if ($validation) {
            return $validation;
        }
        
        try {
            $nginxPaths = ServerManagerV1SSLConfigReader::getNginxPaths();
            $availablePath = $nginxPaths['config_path'];
            $enabledPath = $nginxPaths['enabled_path'];
            
            $sites = [];
            $certExpiryCache = []; // per-request cache: cert path => expiry info (sites may share certs)

            // Get available sites
            if (is_dir($availablePath)) {
                $availableFiles = glob($availablePath . '/*');
                
                foreach ($availableFiles as $file) {
                    if (is_file($file)) {
                        $siteName = basename($file);
                        
                        // Skip default nginx files
                        if (in_array($siteName, ['default', 'default.conf'])) {
                            continue;
                        }
                        
                        $isEnabled = is_link($enabledPath . '/' . $siteName);
                        
                        $siteInfo = [
                            'name' => $siteName,
                            'enabled' => $isEnabled,
                            'config_file' => $file,
                            'enabled_file' => $enabledPath . '/' . $siteName,
                            'size' => filesize($file),
                            'modified' => filemtime($file),
                            'modified_human' => date('Y-m-d H:i:s', filemtime($file))
                        ];
                        
                        // Try to extract domain and type from config
                        $configInfo = $this->parseNginxConfig($file);
                        $siteInfo = array_merge($siteInfo, $configInfo);

                        // Certificate expiry enrichment (never fails the listing)
                        $siteInfo['cert_expiry'] = null;
                        $certPath = $siteInfo['ssl_certificate'] ?? null;
                        if (is_string($certPath) && $certPath !== '' && is_file($certPath)) {
                            if (!array_key_exists($certPath, $certExpiryCache)) {
                                $certExpiryCache[$certPath] = $this->readCertificateExpiry($certPath);
                            }
                            $siteInfo['cert_expiry'] = $certExpiryCache[$certPath];
                        }

                        $sites[] = $siteInfo;
                    }
                }
            }
            
            // Sort by name
            usort($sites, function($a, $b) {
                return strcmp($a['name'], $b['name']);
            });
            
            return $this->success([
                'sites' => $sites,
                'total_sites' => count($sites),
                'enabled_sites' => count(array_filter($sites, fn($s) => $s['enabled'])),
                'disabled_sites' => count(array_filter($sites, fn($s) => !$s['enabled'])),
                'paths' => $nginxPaths
            ], 'Nginx sites retrieved successfully');
            
        } catch (\Exception $e) {
            return $this->handleException($e, 'nginx_list_sites');
        }
    }

    /**
     * Create new nginx site
     */
    public function createSite(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'nginx_create_site');
        if ($validation) {
            return $validation;
        }

        try {
            $siteName = $request->input('site_name');
            $domain = $request->input('domain');
            $siteType = $request->input('site_type', 'laravel');
            $config = $request->input('config', []);
            $sslEnabled = $request->input('ssl_enabled', false);
            $autoSsl = $request->input('auto_ssl', false);
            $dnsProvider = $request->input('dns_provider', 'none');

            // Validate required parameters
            if (empty($siteName) || empty($domain)) {
                return $this->error('site_name and domain are required');
            }

            $nginxPaths = ServerManagerV1SSLConfigReader::getNginxPaths();
            $configFile = $nginxPaths['config_path'] . '/' . $siteName;

            // Check if site already exists
            if (file_exists($configFile)) {
                return $this->error("Site already exists: $siteName", ServerManagerV1Constants::RESPONSE_CONFLICT);
            }

            // SSL: issue/reuse the cert FIRST so its files exist before the nginx
            // config references them (nginx -t fails on a missing ssl_certificate).
            // generateCertificate uses --keep-until-expiring, so an existing valid
            // cert is reused idempotently. SSL directives are written only when a
            // cert is actually present (generated now, or pre-existing on disk).
            $sslReady = false;
            $sslMessage = null;
            $certPath = \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getLetsEncryptCertPath($domain);
            if ($sslEnabled) {
                if ($autoSsl) {
                    Log::info('ServerManagerV1: Auto-generating SSL certificate', [
                        'domain' => $domain,
                        'dns_provider' => $dnsProvider
                    ]);
                    try {
                        $certRequest = new Request([
                            'domain' => $domain,
                            'provider' => $dnsProvider !== 'none' ? $dnsProvider : null,
                            'staging' => false
                        ]);
                        $certCtl = new ServerManagerV1CertificateManagerCtl();
                        $certResult = $certCtl->generateCertificate($certRequest);
                        $sslReady = (bool) ($certResult->getData()->success ?? false);
                        $sslMessage = $sslReady
                            ? 'SSL certificate generated/reused'
                            : 'SSL certificate generation failed: ' . ($certResult->getData()->message ?? 'Unknown error');
                    } catch (\Exception $e) {
                        Log::error('ServerManagerV1: SSL generation failed', [
                            'domain' => $domain,
                            'error' => $e->getMessage()
                        ]);
                        $sslMessage = 'SSL generation error: ' . $e->getMessage();
                    }
                }
                // A pre-existing cert (issued out-of-band) also enables SSL config.
                if (!$sslReady && file_exists($certPath)) {
                    $sslReady = true;
                    $sslMessage = $sslMessage ?? 'SSL certificate already present';
                }
            }

            // Generate nginx configuration (SSL directives only when the cert is ready).
            $nginxConfig = $this->generateNginxConfig($domain, $siteType, $config, $sslReady);

            $binary = $this->detectNginxBinary();
            if ($binary === null) {
                return $this->error(self::NGINX_INSTALL_HINT, ServerManagerV1Constants::RESPONSE_BAD_REQUEST);
            }

            // Write configuration file
            if (file_put_contents($configFile, $nginxConfig) === false) {
                return $this->error("Failed to create site configuration: $siteName", ServerManagerV1Constants::RESPONSE_INTERNAL_ERROR);
            }

            // Test nginx configuration
            $testResult = $this->runConfigTest($binary);
            if (!$testResult['success']) {
                // Remove the invalid configuration file
                unlink($configFile);
                return $this->error('Invalid nginx configuration: ' . $testResult['error'], ServerManagerV1Constants::RESPONSE_BAD_REQUEST);
            }

            $responseData = [
                'site_name' => $siteName,
                'domain' => $domain,
                'type' => $siteType,
                'config_file' => $configFile,
                'enabled' => false,
                'ssl_enabled' => $sslEnabled,
                'ssl_configured' => $sslReady
            ];
            if ($sslMessage !== null) {
                $responseData['ssl_message'] = $sslMessage;
            }

            // Best-effort reload so the running nginx serves the new site (idempotent;
            // the config test already passed above, including runtime-dir repair).
            $responseData['reloaded'] = $this->runServiceAction('reload')['result']['success'];

            Log::info('ServerManagerV1: Nginx site created', [
                'site_name' => $siteName,
                'domain' => $domain,
                'type' => $siteType,
                'ssl_enabled' => $sslEnabled,
                'ssl_configured' => $sslReady,
                'auto_ssl' => $autoSsl,
                'ip' => $request->ip()
            ]);

            return $this->success($responseData, 'Site created successfully');

        } catch (\Exception $e) {
            return $this->handleException($e, 'nginx_create_site');
        }
    }

    /**
     * Get nginx site configuration
     */
    public function getSiteConfig(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'nginx_get_config');
        if ($validation) {
            return $validation;
        }
        
        $paramValidation = $this->validateParameters($request, ['site_name']);
        if ($paramValidation) {
            return $paramValidation;
        }
        
        try {
            $siteName = $request->input('site_name');
            $nginxPaths = ServerManagerV1SSLConfigReader::getNginxPaths();
            $configFile = $nginxPaths['config_path'] . '/' . $siteName;
            
            if (!file_exists($configFile)) {
                return $this->error(
                    "Site configuration not found: $siteName",
                    ServerManagerV1Constants::RESPONSE_NOT_FOUND
                );
            }
            
            $content = file_get_contents($configFile);
            if ($content === false) {
                return $this->error(
                    "Failed to read site configuration: $siteName",
                    ServerManagerV1Constants::RESPONSE_INTERNAL_ERROR
                );
            }
            
            $configInfo = $this->parseNginxConfig($configFile);
            $isEnabled = is_link($nginxPaths['enabled_path'] . '/' . $siteName);
            
            return $this->success([
                'site_name' => $siteName,
                'enabled' => $isEnabled,
                'config_file' => $configFile,
                'content' => $content,
                'size' => strlen($content),
                'lines' => substr_count($content, "\n") + 1,
                'modified' => filemtime($configFile),
                'modified_human' => date('Y-m-d H:i:s', filemtime($configFile)),
                'parsed_info' => $configInfo
            ], 'Site configuration retrieved successfully');
            
        } catch (\Exception $e) {
            return $this->handleException($e, 'nginx_get_config');
        }
    }

    /**
     * Update existing nginx site
     */
    public function updateSite(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'nginx_update_site');
        if ($validation) {
            return $validation;
        }

        try {
            $siteName = $request->route('site_name');
            $siteConfig = $request->input('site_config');

            // Two accepted contracts:
            //  (a) raw `site_config` text (in-place config editor), OR
            //  (b) the same structured body as createSite ({domain, site_type,
            //      config, ...}) regenerated server-side. The live edit flow
            //      sends (b), so generate the config when raw text is absent.
            if (empty($siteConfig)) {
                $domain = $request->input('domain');
                if (!empty($domain)) {
                    $siteType = $request->input('site_type', 'laravel');
                    $config = $request->input('config', []);
                    $siteConfig = $this->generateNginxConfig($domain, $siteType, $config);
                }
            }

            if (empty($siteConfig)) {
                return $this->error('site_config (or a structured {domain, site_type, config} body) is required');
            }

            $nginxPaths = ServerManagerV1SSLConfigReader::getNginxPaths();
            $configFile = $nginxPaths['config_path'] . '/' . $siteName;

            // Check if site exists
            if (!file_exists($configFile)) {
                return $this->error("Site not found: $siteName", ServerManagerV1Constants::RESPONSE_NOT_FOUND);
            }

            $binary = $this->detectNginxBinary();
            if ($binary === null) {
                return $this->error(self::NGINX_INSTALL_HINT, ServerManagerV1Constants::RESPONSE_BAD_REQUEST);
            }

            // Backup current configuration
            $backupFile = $nginxPaths['backup_path'] . '/' . $siteName . '_' . date('Y-m-d_H-i-s') . '.backup';
            if (!copy($configFile, $backupFile)) {
                return $this->error("Failed to backup current configuration", ServerManagerV1Constants::RESPONSE_INTERNAL_ERROR);
            }

            // Write new configuration
            if (file_put_contents($configFile, $siteConfig) === false) {
                return $this->error("Failed to update site configuration: $siteName", ServerManagerV1Constants::RESPONSE_INTERNAL_ERROR);
            }

            // Test nginx configuration
            $testResult = $this->runConfigTest($binary);
            if (!$testResult['success']) {
                // Restore backup if test fails
                copy($backupFile, $configFile);
                return $this->error('Invalid nginx configuration: ' . $testResult['error'], ServerManagerV1Constants::RESPONSE_BAD_REQUEST);
            }

            Log::info('ServerManagerV1: Nginx site updated', [
                'site_name' => $siteName,
                'backup_file' => $backupFile,
                'ip' => $request->ip()
            ]);

            return $this->success([
                'site_name' => $siteName,
                'config_file' => $configFile,
                'backup_file' => $backupFile,
                'updated' => true
            ], 'Site updated successfully');

        } catch (\Exception $e) {
            return $this->handleException($e, 'nginx_update_site');
        }
    }

    /**
     * Delete nginx site
     */
    public function deleteSite(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'nginx_delete_site');
        if ($validation) {
            return $validation;
        }

        try {
            $siteName = $request->route('site_name');
            $nginxPaths = ServerManagerV1SSLConfigReader::getNginxPaths();
            $configFile = $nginxPaths['config_path'] . '/' . $siteName;
            $enabledFile = $nginxPaths['enabled_path'] . '/' . $siteName;

            // Check if site exists
            if (!file_exists($configFile)) {
                return $this->error("Site not found: $siteName", ServerManagerV1Constants::RESPONSE_NOT_FOUND);
            }

            // Disable site first if it's enabled
            if (is_link($enabledFile)) {
                unlink($enabledFile);
            }

            // Backup configuration before deletion
            $backupFile = $nginxPaths['backup_path'] . '/' . $siteName . '_deleted_' . date('Y-m-d_H-i-s') . '.backup';
            if (!copy($configFile, $backupFile)) {
                Log::warning("Failed to backup configuration before deletion: $siteName");
            }

            // Delete configuration file
            if (!unlink($configFile)) {
                return $this->error("Failed to delete site configuration: $siteName", ServerManagerV1Constants::RESPONSE_INTERNAL_ERROR);
            }

            // Idempotent reset: ensure runtime dirs + validate + reload so the
            // running nginx drops this site cleanly (best-effort, non-fatal).
            $binary = $this->detectNginxBinary();
            $reloaded = false;
            if ($binary !== null) {
                $test = $this->runConfigTest($binary);
                if ($test['success']) {
                    $reloaded = $this->runServiceAction('reload')['result']['success'];
                }
            }

            Log::info('ServerManagerV1: Nginx site deleted', [
                'site_name' => $siteName,
                'backup_file' => $backupFile,
                'reloaded' => $reloaded,
                'ip' => $request->ip()
            ]);

            return $this->success([
                'site_name' => $siteName,
                'deleted' => true,
                'backup_file' => $backupFile,
                'reloaded' => $reloaded
            ], 'Site deleted successfully');

        } catch (\Exception $e) {
            return $this->handleException($e, 'nginx_delete_site');
        }
    }

    /**
     * Delete a site's actual web-root FILES. The normal deleteSite only removes
     * the nginx config; this destructive action purges the document root too.
     * Requires the root password AND typing "delete" to confirm. The core_node
     * code tree is NEVER deletable: the web root must resolve inside wwwroot and
     * outside core_node, or the call is refused. Backs up the nginx config first,
     * then purges files + config.
     */
    public function deleteSiteFiles(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'nginx_delete_site_files');
        if ($validation) {
            return $validation;
        }

        try {
            $siteName = $request->route('site_name');
            $confirm = (string) $request->input('confirm', '');
            $password = (string) $request->input('password', '');

            if ($confirm !== 'delete') {
                return $this->error('Confirmation mismatch: type "delete" to confirm file deletion.', ServerManagerV1Constants::RESPONSE_BAD_REQUEST);
            }
            if ($password === '') {
                return $this->error('Root password is required to delete site files.', ServerManagerV1Constants::RESPONSE_BAD_REQUEST);
            }

            // Verify the root password (rate-limited) before any deletion.
            $auth = \App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1ElevatedAccess::authenticate($password, $request->ip());
            if (empty($auth['success'])) {
                return $this->error('Authentication failed: ' . ($auth['error'] ?? 'invalid password'), ServerManagerV1Constants::RESPONSE_BAD_REQUEST);
            }

            $nginxPaths = ServerManagerV1SSLConfigReader::getNginxPaths();
            $configFile = $nginxPaths['config_path'] . '/' . $siteName;
            if (!file_exists($configFile)) {
                return $this->error("Site not found: $siteName", ServerManagerV1Constants::RESPONSE_NOT_FOUND);
            }

            // Resolve the web root from the nginx config (root directive), falling
            // back to the conventional <wwwroot>/<siteName>.
            $parsed = $this->parseNginxConfig($configFile);
            $webRoot = $parsed['root_directory'] ?? null;
            if (!$webRoot) {
                $webRoot = \App\Providers\PathMapper::mapWebPath('wwwroot') . '/' . $siteName;
            }
            $webRoot = rtrim($webRoot, '/');

            // Guardrails: never delete the core_node tree, and only delete inside wwwroot.
            $coreReal = realpath(\App\Providers\PathMapper::getCoreNodeDir()) ?: \App\Providers\PathMapper::getCoreNodeDir();
            $wwwrootReal = realpath(\App\Providers\PathMapper::mapWebPath('wwwroot')) ?: \App\Providers\PathMapper::mapWebPath('wwwroot');
            $webReal = realpath($webRoot) ?: $webRoot;
            if ($webRoot === '' || $webReal === '' || $webReal === '/' ||
                strpos($webReal, $coreReal) === 0 ||
                strpos($webReal, $wwwrootReal) !== 0) {
                return $this->error('Refused: site web root is empty, outside wwwroot, or inside the protected core_node directory.', ServerManagerV1Constants::RESPONSE_BAD_REQUEST);
            }

            // Disable + back up the nginx config (same as deleteSite), then purge
            // the web root files and remove the config.
            $enabledFile = $nginxPaths['enabled_path'] . '/' . $siteName;
            if (is_link($enabledFile)) {
                @unlink($enabledFile);
            }
            $backupFile = $nginxPaths['backup_path'] . '/' . $siteName . '_purged_' . date('Y-m-d_H-i-s') . '.backup';
            @copy($configFile, $backupFile);

            $deleteResult = \App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1ElevatedAccess::deletePathWithSudo($webRoot, $password);
            @unlink($configFile);

            if (!$deleteResult['success']) {
                Log::warning('ServerManagerV1: Site file purge partial failure', [
                    'site_name' => $siteName, 'web_root' => $webRoot, 'error' => $deleteResult['error'] ?? '',
                ]);
                return $this->error('Site config removed, but file deletion failed: ' . ($deleteResult['error'] ?? 'unknown'), ServerManagerV1Constants::RESPONSE_INTERNAL_ERROR, ['web_root' => $webRoot]);
            }

            Log::warning('ServerManagerV1: Site files purged', [
                'site_name' => $siteName, 'web_root' => $webRoot, 'ip' => $request->ip(),
            ]);

            return $this->success([
                'site_name' => $siteName,
                'deleted' => true,
                'web_root' => $webRoot,
                'backup_file' => $backupFile,
            ], 'Site files deleted successfully');

        } catch (\Exception $e) {
            return $this->handleException($e, 'nginx_delete_site_files');
        }
    }

    /**
     * Enable nginx site
     */
    public function enableSite(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'nginx_enable_site');
        if ($validation) {
            return $validation;
        }
        
        $paramValidation = $this->validateParameters($request, ['site_name']);
        if ($paramValidation) {
            return $paramValidation;
        }
        
        try {
            $siteName = $request->input('site_name');
            $op = $this->performEnableSite($siteName);

            if (!$op['success']) {
                return $this->error($op['message'], $op['code']);
            }

            if (empty($op['data']['already_enabled'])) {
                Log::info('ServerManagerV1: Nginx site enabled', [
                    'site_name' => $siteName,
                    'ip' => $request->ip()
                ]);
            }

            return $this->success($op['data'], $op['message']);

        } catch (\Exception $e) {
            return $this->handleException($e, 'nginx_enable_site');
        }
    }

    /**
     * Internal enable-site operation (shared by enableSite and batchSites)
     *
     * @return array{success: bool, message: string, code: int, data: array}
     */
    private function performEnableSite(string $siteName): array
    {
        $nginxPaths = ServerManagerV1SSLConfigReader::getNginxPaths();
        $availableFile = $nginxPaths['config_path'] . '/' . $siteName;
        $enabledFile = $nginxPaths['enabled_path'] . '/' . $siteName;

        if (!file_exists($availableFile)) {
            return [
                'success' => false,
                'message' => "Site configuration not found: $siteName",
                'code' => ServerManagerV1Constants::RESPONSE_NOT_FOUND,
                'data' => []
            ];
        }

        if (is_link($enabledFile)) {
            return [
                'success' => true,
                'message' => 'Site is already enabled',
                'code' => ServerManagerV1Constants::RESPONSE_SUCCESS,
                'data' => [
                    'site_name' => $siteName,
                    'already_enabled' => true
                ]
            ];
        }

        $binary = $this->detectNginxBinary();
        if ($binary === null) {
            return [
                'success' => false,
                'message' => self::NGINX_INSTALL_HINT,
                'code' => ServerManagerV1Constants::RESPONSE_BAD_REQUEST,
                'data' => []
            ];
        }

        // Test nginx configuration before enabling
        $testResult = $this->runConfigTest($binary);
        if (!$testResult['success']) {
            return [
                'success' => false,
                'message' => 'Nginx configuration test failed: ' . $testResult['error'],
                'code' => ServerManagerV1Constants::RESPONSE_BAD_REQUEST,
                'data' => []
            ];
        }

        // Create symlink
        if (!symlink($availableFile, $enabledFile)) {
            return [
                'success' => false,
                'message' => "Failed to enable site: $siteName",
                'code' => ServerManagerV1Constants::RESPONSE_INTERNAL_ERROR,
                'data' => []
            ];
        }

        // Test configuration again with new site
        $testResult = $this->runConfigTest($binary);
        if (!$testResult['success']) {
            // Remove the symlink if test fails
            unlink($enabledFile);
            return [
                'success' => false,
                'message' => 'Site configuration is invalid: ' . $testResult['error'],
                'code' => ServerManagerV1Constants::RESPONSE_BAD_REQUEST,
                'data' => []
            ];
        }

        return [
            'success' => true,
            'message' => 'Site enabled successfully',
            'code' => ServerManagerV1Constants::RESPONSE_SUCCESS,
            'data' => [
                'site_name' => $siteName,
                'enabled' => true,
                'enabled_file' => $enabledFile
            ]
        ];
    }
    
    /**
     * Disable nginx site
     */
    public function disableSite(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'nginx_disable_site');
        if ($validation) {
            return $validation;
        }
        
        $paramValidation = $this->validateParameters($request, ['site_name']);
        if ($paramValidation) {
            return $paramValidation;
        }
        
        try {
            $siteName = $request->input('site_name');
            $op = $this->performDisableSite($siteName);

            if (!$op['success']) {
                return $this->error($op['message'], $op['code']);
            }

            if (empty($op['data']['already_disabled'])) {
                Log::info('ServerManagerV1: Nginx site disabled', [
                    'site_name' => $siteName,
                    'ip' => $request->ip()
                ]);
            }

            return $this->success($op['data'], $op['message']);

        } catch (\Exception $e) {
            return $this->handleException($e, 'nginx_disable_site');
        }
    }

    /**
     * Internal disable-site operation (shared by disableSite and batchSites)
     *
     * @return array{success: bool, message: string, code: int, data: array}
     */
    private function performDisableSite(string $siteName): array
    {
        $nginxPaths = ServerManagerV1SSLConfigReader::getNginxPaths();
        $enabledFile = $nginxPaths['enabled_path'] . '/' . $siteName;

        if (!is_link($enabledFile)) {
            return [
                'success' => true,
                'message' => 'Site is already disabled',
                'code' => ServerManagerV1Constants::RESPONSE_SUCCESS,
                'data' => [
                    'site_name' => $siteName,
                    'already_disabled' => true
                ]
            ];
        }

        // Remove symlink
        if (!unlink($enabledFile)) {
            return [
                'success' => false,
                'message' => "Failed to disable site: $siteName",
                'code' => ServerManagerV1Constants::RESPONSE_INTERNAL_ERROR,
                'data' => []
            ];
        }

        return [
            'success' => true,
            'message' => 'Site disabled successfully',
            'code' => ServerManagerV1Constants::RESPONSE_SUCCESS,
            'data' => [
                'site_name' => $siteName,
                'enabled' => false
            ]
        ];
    }
    
    /**
     * Test nginx configuration
     */
    public function testConfig(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'nginx_test_config');
        if ($validation) {
            return $validation;
        }
        
        try {
            $binary = $this->detectNginxBinary();
            if ($binary === null) {
                return $this->error(self::NGINX_INSTALL_HINT, ServerManagerV1Constants::RESPONSE_BAD_REQUEST);
            }

            $result = $this->runConfigTest($binary);

            return $this->success([
                'valid' => $result['success'],
                'output' => $result['output'],
                'error' => $result['error'],
                'exit_code' => $result['exit_code']
            ], $result['success'] ? 'Nginx configuration is valid' : 'Nginx configuration has errors');

        } catch (\Exception $e) {
            return $this->handleException($e, 'nginx_test_config');
        }
    }

    /**
     * Reload nginx
     */
    public function reloadNginx(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'nginx_reload');
        if ($validation) {
            return $validation;
        }

        try {
            $binary = $this->detectNginxBinary();
            if ($binary === null) {
                return $this->error(self::NGINX_INSTALL_HINT, ServerManagerV1Constants::RESPONSE_BAD_REQUEST);
            }

            // Test configuration first
            $testResult = $this->runConfigTest($binary);
            if (!$testResult['success']) {
                return $this->error(
                    'Cannot reload nginx: configuration test failed - ' . $testResult['error'],
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }

            // Reload nginx (systemctl with `service` fallback for WSL without systemd)
            $serviceRun = $this->runServiceAction('reload');
            $reloadResult = $serviceRun['result'];

            Log::info('ServerManagerV1: Nginx reload attempted', [
                'success' => $reloadResult['success'],
                'executed_via' => $serviceRun['executed_via'],
                'ip' => $request->ip()
            ]);

            return $this->success([
                'reloaded' => $reloadResult['success'],
                'output' => $reloadResult['output'],
                'error' => $reloadResult['error'],
                'test_output' => $testResult['output'],
                'executed_via' => $serviceRun['executed_via']
            ], $reloadResult['success'] ? 'Nginx reloaded successfully' : 'Nginx reload failed');

        } catch (\Exception $e) {
            return $this->handleException($e, 'nginx_reload');
        }
    }

    /**
     * Nginx status overview (installation, process, config test, sites summary).
     * Never fails when nginx is missing - always returns 200 with installed:false.
     */
    public function statusOverview(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'nginx_status_overview');
        if ($validation) {
            return $validation;
        }

        try {
            $binary = $this->detectNginxBinary();
            $installed = $binary !== null;

            // Version: `nginx -v` prints "nginx version: nginx/1.24.0" on STDERR
            $version = $installed ? $this->getNginxVersion($binary) : null;

            // Capability fields mirror the shell end (nginx_manager.sh
            // `status --json`) so both ends report the same truth:
            // version, http3, quic early data, openssl, config validity.
            $http3 = $installed ? ServerManagerV1NginxInfo::hasHttp3() : false;
            $quicEarlyData = $installed ? ServerManagerV1NginxInfo::quicEarlyDataSupported() : false;
            $opensslVersion = $installed ? ServerManagerV1NginxInfo::getOpensslVersion() : null;

            // Running state via pgrep
            $running = false;
            $processCount = 0;
            $pgrepResult = ServerManagerV1Utils::executeCommand('pgrep', ['-x', 'nginx']);
            if (($pgrepResult['exit_code'] ?? -1) === 0) {
                $running = true;
                $pgrepLines = array_filter(array_map('trim', explode("\n", $pgrepResult['output'] ?? '')));
                $processCount = count($pgrepLines);
            }

            // Service manager detection
            $serviceManager = null;
            $systemctlCheck = ServerManagerV1Utils::executeCommand('which', ['systemctl']);
            if ($systemctlCheck['success'] && trim($systemctlCheck['output']) !== '') {
                $serviceManager = 'systemctl';
            } else {
                $serviceCheck = ServerManagerV1Utils::executeCommand('which', ['service']);
                if ($serviceCheck['success'] && trim($serviceCheck['output']) !== '') {
                    $serviceManager = 'service';
                }
            }

            // Config test (only when installed)
            $configTest = null;
            if ($installed) {
                $testResult = $this->runConfigTest($binary);
                $configTest = [
                    'valid' => $testResult['success'],
                    'output' => trim(($testResult['output'] ?? '') . "\n" . ($testResult['error'] ?? ''))
                ];
            }

            // Sites summary
            $nginxPaths = ServerManagerV1SSLConfigReader::getNginxPaths();
            $configPath = $nginxPaths['config_path'] ?? '';
            $enabledPath = $nginxPaths['enabled_path'] ?? '';
            $backupPath = $nginxPaths['backup_path']
                ?? \App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig::getNginxBackupDir();

            $totalSites = $this->countSiteFiles($configPath);
            $enabledSites = $this->countSiteFiles($enabledPath);
            $disabledSites = max(0, $totalSites - $enabledSites);

            return $this->success([
                'installed' => $installed,
                'binary' => $binary,
                'version' => $version,
                'http3' => $http3,
                'quic_early_data' => $quicEarlyData,
                'openssl' => $opensslVersion,
                'running' => $running,
                'process_count' => $processCount,
                'service_manager' => $serviceManager,
                'config_test' => $configTest,
                'sites' => [
                    'total' => $totalSites,
                    'enabled' => $enabledSites,
                    'disabled' => $disabledSites
                ],
                'paths' => [
                    'config_path' => $configPath,
                    'enabled_path' => $enabledPath,
                    'backup_path' => $backupPath
                ],
                'install_hint' => $installed ? null : self::NGINX_INSTALL_HINT
            ], 'Nginx status retrieved successfully');

        } catch (\Exception $e) {
            return $this->handleException($e, 'nginx_status_overview');
        }
    }

    /**
     * Control the nginx service (start/stop/restart/reload/status)
     */
    public function serviceControl(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'nginx_service_control');
        if ($validation) {
            return $validation;
        }

        try {
            $action = $request->input('action');
            $allowedActions = ['start', 'stop', 'restart', 'reload', 'status'];

            if (!in_array($action, $allowedActions, true)) {
                return $this->error(
                    'Invalid action. Allowed actions: ' . implode(', ', $allowedActions),
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }

            $binary = $this->detectNginxBinary();
            if ($binary === null) {
                return $this->error(self::NGINX_INSTALL_HINT, ServerManagerV1Constants::RESPONSE_BAD_REQUEST);
            }

            // Reload requires a valid configuration first
            if ($action === 'reload') {
                $testResult = $this->runConfigTest($binary);
                if (!$testResult['success']) {
                    $testOutput = trim(($testResult['output'] ?? '') . "\n" . ($testResult['error'] ?? ''));
                    return $this->error(
                        'Cannot reload nginx: configuration test failed - ' . $testOutput,
                        ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                    );
                }
            }

            // Ensure runtime dirs (log/run) exist so start/restart don't fail on
            // a missing /var/log/nginx (idempotent; also done in runConfigTest).
            $this->ensureNginxRuntimeDirs();
            $serviceRun = $this->runServiceAction($action);
            $result = $serviceRun['result'];

            Log::info('ServerManagerV1: Nginx service action executed', [
                'action' => $action,
                'executed_via' => $serviceRun['executed_via'],
                'success' => $result['success'],
                'ip' => $request->ip()
            ]);

            return $this->success([
                'action' => $action,
                'executed_via' => $serviceRun['executed_via'],
                'success' => $result['success'],
                'output' => $result['output'],
                'error' => $result['error']
            ], $result['success']
                ? "Nginx service action '$action' executed successfully"
                : "Nginx service action '$action' failed");

        } catch (\Exception $e) {
            return $this->handleException($e, 'nginx_service_control');
        }
    }

    /**
     * Idempotently repair + reset the nginx config: ensure runtime dirs, test the
     * config, and if it is invalid quarantine the broken site config(s) (back up
     * + remove the sites-enabled symlink / sites-available file) until `nginx -t`
     * passes, then reload. Always returns a report of what was done. Intended to
     * be called after add/delete operations and from a "Repair Config" button.
     */
    public function repairConfig(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'nginx_repair_config');
        if ($validation) {
            return $validation;
        }

        try {
            $binary = $this->detectNginxBinary();
            if ($binary === null) {
                return $this->error(self::NGINX_INSTALL_HINT, ServerManagerV1Constants::RESPONSE_BAD_REQUEST);
            }

            $report = [
                'dir_fixes' => [],
                'quarantined' => [],
                'valid' => false,
                'reloaded' => false,
                'error' => null,
            ];

            // 1. Ensure runtime dirs (fixes the missing /var/log/nginx case).
            $report['dir_fixes'] = $this->ensureNginxRuntimeDirs()['actions'];

            // 2. Test config.
            $test = $this->runConfigTest($binary);
            $report['valid'] = $test['success'];

            // 3. If invalid, quarantine broken site configs one at a time until valid.
            if (!$test['success']) {
                $nginxPaths = ServerManagerV1SSLConfigReader::getNginxPaths();
                $enabledDir = $nginxPaths['enabled_path'] ?? '';
                $availableDir = $nginxPaths['config_path'] ?? '';
                $backupDir = $nginxPaths['backup_path'] ?? '';
                $attempts = 0;
                $maxAttempts = 60;
                while (!$test['success'] && $attempts < $maxAttempts) {
                    $attempts++;
                    $err = trim(($test['error'] ?? '') . "\n" . ($test['output'] ?? ''));
                    $broken = $this->extractBrokenConfigPath($err, $enabledDir, $availableDir);
                    if ($broken === null) {
                        break; // cannot identify a site config to quarantine
                    }
                    if (!$this->quarantineSiteConfig($broken, $backupDir)) {
                        break;
                    }
                    $report['quarantined'][] = $broken;
                    $test = $this->runConfigTest($binary);
                    $report['valid'] = $test['success'];
                }
            }

            // 4. If valid now, reload so the running nginx picks up the clean config.
            if ($report['valid']) {
                $serviceRun = $this->runServiceAction('reload');
                $report['reloaded'] = $serviceRun['result']['success'];
            } else {
                $report['error'] = trim(($test['error'] ?? '') . "\n" . ($test['output'] ?? ''));
            }

            Log::info('ServerManagerV1: Nginx config repair', $report);

            return $this->success($report, $report['valid']
                ? 'Nginx config repaired' . ($report['reloaded'] ? ' and reloaded' : '')
                : 'Nginx config still invalid after repair');

        } catch (\Exception $e) {
            return $this->handleException($e, 'nginx_repair_config');
        }
    }

    /**
     * Tail nginx access/error logs
     */
    public function logs(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'nginx_logs');
        if ($validation) {
            return $validation;
        }

        try {
            $type = $request->input('type', 'error');
            if (!in_array($type, ['access', 'error'], true)) {
                return $this->error(
                    "Invalid log type. Allowed types: access, error",
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }

            $lines = (int) $request->input('lines', 200);
            $lines = max(10, min(2000, $lines));

            $filter = (string) $request->input('filter', '');
            if (strlen($filter) > 200) {
                return $this->error(
                    'filter must be at most 200 characters',
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }

            $file = "/var/log/nginx/$type.log";

            if (!is_file($file)) {
                return $this->success([
                    'type' => $type,
                    'file' => $file,
                    'exists' => false,
                    'lines' => [],
                    'size_bytes' => 0,
                    'filter' => $filter !== '' ? $filter : null,
                    'scanned_lines' => 0
                ], 'Log file does not exist');
            }

            $sizeBytes = filesize($file);

            if ($filter !== '') {
                // Scan a larger tail window and keep the last N matching lines
                $scanWindow = (int) min($lines * 10, 5000);
                $scannedLines = $this->tailFile($file, $scanWindow);
                $matching = array_values(array_filter(
                    $scannedLines,
                    fn($line) => stripos($line, $filter) !== false
                ));
                $logLines = array_values(array_slice($matching, -$lines));
                $scannedCount = count($scannedLines);
            } else {
                $logLines = $this->tailFile($file, $lines);
                $scannedCount = count($logLines);
            }

            return $this->success([
                'type' => $type,
                'file' => $file,
                'exists' => true,
                'lines' => $logLines,
                'size_bytes' => $sizeBytes !== false ? $sizeBytes : 0,
                'filter' => $filter !== '' ? $filter : null,
                'scanned_lines' => $scannedCount
            ], 'Log lines retrieved successfully');

        } catch (\Exception $e) {
            return $this->handleException($e, 'nginx_logs');
        }
    }

    /**
     * Install nginx via the idempotent repo installer script.
     * No-op (already_installed) when the binary is already present.
     */
    public function install(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'nginx_install');
        if ($validation) {
            return $validation;
        }

        try {
            $binary = $this->detectNginxBinary();
            if ($binary !== null) {
                return $this->success([
                    'installed' => true,
                    'already_installed' => true,
                    'version' => $this->getNginxVersion($binary),
                    'binary' => $binary
                ], 'Nginx is already installed');
            }

            // Repo root: laravel_main lives at <repo>/poly_apps/laravel_main
            $repoRoot = dirname(dirname(base_path()));
            $script = $repoRoot . '/scripts/shells/linux/debian/install_shells/33_install_nginx.sh';

            if (!is_file($script)) {
                return $this->error(
                    "Installer script not found: $script",
                    ServerManagerV1Constants::RESPONSE_NOT_FOUND
                );
            }

            // Detect root (posix_getuid may be unavailable on some builds)
            if (function_exists('posix_getuid')) {
                $isRoot = posix_getuid() === 0;
            } else {
                $idResult = ServerManagerV1Utils::executeCommand('id', ['-u']);
                $isRoot = trim($idResult['output'] ?? '') === '0';
            }

            $env = [
                'START_NGINX' => 'true',
                'DEBIAN_FRONTEND' => 'noninteractive'
            ];

            Log::info('ServerManagerV1: Nginx install started', [
                'script' => $script,
                'is_root' => $isRoot,
                'ip' => $request->ip()
            ]);

            if ($isRoot) {
                $result = ServerManagerV1Utils::executeCommand('bash', [$script], 900, $env);
            } else {
                // sudo -n: non-interactive; `env` carries the vars across sudo's env_reset
                $result = ServerManagerV1Utils::executeCommand('sudo', [
                    '-n', 'env',
                    'START_NGINX=true',
                    'DEBIAN_FRONTEND=noninteractive',
                    'bash', $script
                ], 900, $env);
            }

            $combined = ($result['output'] ?? '') . "\n" . ($result['error'] ?? '');

            if (!$isRoot && !$result['success'] && stripos($combined, 'password is required') !== false) {
                return $this->error(
                    'sudo requires a password on this host, the installer cannot run non-interactively. '
                        . "Run it manually: sudo bash $script",
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }

            // Reset the binary cache and re-detect so this (and other) workers see the new binary
            self::resetNginxBinaryCache();
            $binary = $this->detectNginxBinary();
            $installed = $binary !== null;

            Log::info('ServerManagerV1: Nginx install finished', [
                'installed' => $installed,
                'exit_code' => $result['exit_code'],
                'ip' => $request->ip()
            ]);

            return $this->success([
                'installed' => $installed,
                'already_installed' => false,
                'version' => $installed ? $this->getNginxVersion($binary) : null,
                'binary' => $binary,
                'output' => substr(trim($combined), -4000),
                'exit_code' => $result['exit_code']
            ], $installed ? 'Nginx installed successfully' : 'Nginx installation did not produce a usable binary');

        } catch (\Exception $e) {
            return $this->handleException($e, 'nginx_install');
        }
    }

    /**
     * List nginx configuration backups (optionally filtered by ?site=)
     */
    public function listBackups(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'nginx_list_backups');
        if ($validation) {
            return $validation;
        }

        try {
            $siteFilter = $request->query('site');
            $nginxPaths = ServerManagerV1SSLConfigReader::getNginxPaths();
            $backupPath = $nginxPaths['backup_path'] ?? '';

            $backups = [];
            if ($backupPath !== '' && is_dir($backupPath)) {
                $files = glob($backupPath . '/*.backup') ?: [];
                foreach ($files as $file) {
                    if (!is_file($file)) {
                        continue;
                    }

                    $name = basename($file);
                    $parsed = $this->parseBackupFileName($name);

                    if (!empty($siteFilter) && $parsed['site'] !== $siteFilter) {
                        continue;
                    }

                    $mtime = filemtime($file);
                    $backups[] = [
                        'file' => $name,
                        'site' => $parsed['site'],
                        'type' => $parsed['type'],
                        'size_bytes' => filesize($file) ?: 0,
                        'created_at' => date('c', $mtime !== false ? $mtime : time()),
                        '_mtime' => $mtime !== false ? $mtime : 0
                    ];
                }
            }

            // Newest first
            usort($backups, fn($a, $b) => $b['_mtime'] <=> $a['_mtime']);
            foreach ($backups as &$backup) {
                unset($backup['_mtime']);
            }
            unset($backup);

            return $this->success([
                'backups' => $backups,
                'total' => count($backups),
                'backup_path' => $backupPath,
                'site' => $siteFilter ?: null
            ], 'Backups retrieved successfully');

        } catch (\Exception $e) {
            return $this->handleException($e, 'nginx_list_backups');
        }
    }

    /**
     * Restore an nginx site configuration from a backup file
     */
    public function restoreBackup(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'nginx_restore_backup');
        if ($validation) {
            return $validation;
        }

        $paramValidation = $this->validateParameters($request, ['file']);
        if ($paramValidation) {
            return $paramValidation;
        }

        try {
            $file = (string) $request->input('file');

            // SECURITY: basename only - no traversal, no separators
            if (strpos($file, '/') !== false || strpos($file, '\\') !== false || strpos($file, '..') !== false) {
                return $this->error(
                    'Invalid backup file name (must be a plain file name)',
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }

            if (substr($file, -7) !== '.backup') {
                return $this->error(
                    'Invalid backup file name (must end with .backup)',
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }

            $nginxPaths = ServerManagerV1SSLConfigReader::getNginxPaths();
            $backupPath = $nginxPaths['backup_path'] ?? '';
            $backupFile = $backupPath . '/' . $file;

            if ($backupPath === '' || !is_file($backupFile)) {
                return $this->error(
                    "Backup file not found: $file",
                    ServerManagerV1Constants::RESPONSE_NOT_FOUND
                );
            }

            $parsed = $this->parseBackupFileName($file);
            $site = $parsed['site'];

            if ($site === '') {
                return $this->error(
                    "Cannot derive site name from backup file: $file",
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }

            $configPath = $nginxPaths['config_path'];
            if (!is_dir($configPath)) {
                return $this->error(
                    "Nginx sites-available directory not found: $configPath",
                    ServerManagerV1Constants::RESPONSE_NOT_FOUND
                );
            }

            $configFile = $configPath . '/' . $site;

            // Back up the CURRENT config before overwriting (same scheme as updateSite)
            $previousBackup = null;
            if (file_exists($configFile)) {
                $previousBackup = $backupPath . '/' . $site . '_' . date('Y-m-d_H-i-s') . '.backup';
                if (!copy($configFile, $previousBackup)) {
                    return $this->error(
                        'Failed to back up current configuration before restore',
                        ServerManagerV1Constants::RESPONSE_INTERNAL_ERROR
                    );
                }
            }

            // Restore
            if (!copy($backupFile, $configFile)) {
                return $this->error(
                    "Failed to restore backup to: $configFile",
                    ServerManagerV1Constants::RESPONSE_INTERNAL_ERROR
                );
            }

            // Config test (when nginx is installed); roll back on failure
            $configTest = null;
            $binary = $this->detectNginxBinary();
            if ($binary !== null) {
                $testResult = $this->runConfigTest($binary);
                $configTest = [
                    'valid' => $testResult['success'],
                    'output' => trim(($testResult['output'] ?? '') . "\n" . ($testResult['error'] ?? ''))
                ];

                if (!$testResult['success']) {
                    // Roll back the restore
                    if ($previousBackup !== null) {
                        copy($previousBackup, $configFile);
                    } else {
                        unlink($configFile);
                    }

                    return $this->error(
                        'Restore rolled back: nginx configuration test failed - ' . $configTest['output'],
                        ServerManagerV1Constants::RESPONSE_BAD_REQUEST,
                        [
                            'restored' => false,
                            'site' => $site,
                            'config_test' => $configTest
                        ]
                    );
                }
            }

            Log::info('ServerManagerV1: Nginx backup restored', [
                'file' => $file,
                'site' => $site,
                'previous_backup' => $previousBackup,
                'ip' => $request->ip()
            ]);

            return $this->success([
                'restored' => true,
                'site' => $site,
                'config_file' => $configFile,
                'previous_backup' => $previousBackup,
                'config_test' => $configTest
            ], 'Backup restored successfully');

        } catch (\Exception $e) {
            return $this->handleException($e, 'nginx_restore_backup');
        }
    }

    /**
     * Read the main nginx configuration (/etc/nginx/nginx.conf) and conf.d listing
     */
    public function mainConfig(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'nginx_main_config');
        if ($validation) {
            return $validation;
        }

        try {
            $file = '/etc/nginx/nginx.conf';
            $maxBytes = 1048576; // 1MB cap

            $exists = is_file($file);
            $content = '';
            $truncated = false;

            if ($exists) {
                $size = filesize($file);
                if ($size !== false && $size > $maxBytes) {
                    $content = (string) file_get_contents($file, false, null, 0, $maxBytes);
                    $truncated = true;
                } else {
                    $read = file_get_contents($file);
                    $content = $read !== false ? $read : '';
                }
            }

            // conf.d listing
            $confD = [];
            $confDFiles = glob('/etc/nginx/conf.d/*.conf') ?: [];
            foreach ($confDFiles as $confFile) {
                if (is_file($confFile)) {
                    $confD[] = [
                        'file' => basename($confFile),
                        'size_bytes' => filesize($confFile) ?: 0
                    ];
                }
            }

            // Lightweight directive parsing
            $workerProcesses = null;
            if (preg_match('/^\s*worker_processes\s+([^;]+);/m', $content, $matches)) {
                $workerProcesses = trim($matches[1]);
            }

            $workerConnections = null;
            if (preg_match('/^\s*worker_connections\s+([^;]+);/m', $content, $matches)) {
                $workerConnections = trim($matches[1]);
            }

            $includes = [];
            if (preg_match_all('/^\s*include\s+([^;]+);/m', $content, $matches)) {
                $includes = array_values(array_map('trim', $matches[1]));
            }

            return $this->success([
                'file' => $file,
                'exists' => $exists,
                'content' => $content,
                'truncated' => $truncated,
                'conf_d' => $confD,
                'parsed' => [
                    'worker_processes' => $workerProcesses,
                    'worker_connections' => $workerConnections,
                    'includes' => $includes
                ]
            ], $exists ? 'Main configuration retrieved successfully' : 'Main configuration file does not exist');

        } catch (\Exception $e) {
            return $this->handleException($e, 'nginx_main_config');
        }
    }

    /**
     * Check whether a TCP port has a listener (ss with netstat fallback)
     */
    public function portCheck(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'nginx_port_check');
        if ($validation) {
            return $validation;
        }

        try {
            $port = (int) $request->query('port', 80);
            if ($port < 1 || $port > 65535) {
                return $this->error(
                    'port must be between 1 and 65535',
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }

            $source = 'ss';
            $result = ServerManagerV1Utils::executeCommand('ss', ['-ltnpH']);
            if (!$result['success']) {
                $source = 'netstat';
                $result = ServerManagerV1Utils::executeCommand('netstat', ['-ltnp']);
            }

            $inUse = false;
            $holder = null;
            $isNginx = false;

            if ($result['success']) {
                foreach (explode("\n", $result['output'] ?? '') as $line) {
                    $line = trim($line);
                    if ($line === '') {
                        continue;
                    }

                    $cols = preg_split('/\s+/', $line);

                    if ($source === 'netstat' && stripos($cols[0] ?? '', 'tcp') !== 0) {
                        continue; // skip headers / non-tcp rows
                    }

                    // Local address column: ss -ltnH => col 3, netstat -ltn => col 3
                    $local = $cols[3] ?? null;
                    if ($local === null || !preg_match('/[:.]' . $port . '$/', $local)) {
                        continue;
                    }

                    $inUse = true;

                    $lineHolder = null;
                    if ($source === 'ss') {
                        // users:(("nginx",pid=123,fd=6))
                        if (preg_match('/users:\(\("([^"]+)",pid=(\d+)/', $line, $matches)) {
                            $lineHolder = $matches[1] . ' (pid ' . $matches[2] . ')';
                        }
                    } else {
                        // netstat last column: 123/nginx
                        if (preg_match('/(\d+)\/([^\s]+)/', $cols[6] ?? '', $matches)) {
                            $lineHolder = $matches[2] . ' (pid ' . $matches[1] . ')';
                        }
                    }

                    if ($lineHolder !== null) {
                        if ($holder === null) {
                            $holder = $lineHolder;
                        }
                        if (stripos($lineHolder, 'nginx') !== false) {
                            $isNginx = true;
                        }
                    }
                }
            }

            return $this->success([
                'port' => $port,
                'in_use' => $inUse,
                'holder' => $holder,
                'is_nginx' => $isNginx,
                'source' => $result['success'] ? $source : null
            ], $inUse ? "Port $port is in use" : "Port $port is free");

        } catch (\Exception $e) {
            return $this->handleException($e, 'nginx_port_check');
        }
    }

    /**
     * Nginx metrics: stub_status (if exposed) plus nginx process stats
     */
    public function metrics(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'nginx_metrics');
        if ($validation) {
            return $validation;
        }

        try {
            $available = false;
            $stubStatus = null;
            $hint = null;

            // stub_status probe via PHP stream (no shell), 2s timeout
            $context = stream_context_create([
                'http' => [
                    'method' => 'GET',
                    'timeout' => 2,
                    'ignore_errors' => true
                ]
            ]);

            $body = @file_get_contents('http://127.0.0.1/nginx_status', false, $context);

            $statusCode = 0;
            if (isset($http_response_header[0]) && preg_match('#HTTP/\S+\s+(\d{3})#', $http_response_header[0], $matches)) {
                $statusCode = (int) $matches[1];
            }

            if ($body !== false && $statusCode === 200) {
                $parsedStub = $this->parseStubStatus($body);
                if ($parsedStub !== null) {
                    $available = true;
                    $stubStatus = $parsedStub;
                }
            }

            if (!$available) {
                $hint = 'enable stub_status: location /nginx_status { stub_status; allow 127.0.0.1; deny all; }';
            }

            // Process stats (always attempted; empty when nginx is not running)
            $processes = [];
            $totalMemoryKb = 0;
            $totalCpu = 0.0;

            $psResult = ServerManagerV1Utils::executeCommand('ps', ['-C', 'nginx', '-o', 'pid=,rss=,pcpu=']);
            if ($psResult['success']) {
                foreach (explode("\n", $psResult['output'] ?? '') as $line) {
                    $line = trim($line);
                    if ($line === '') {
                        continue;
                    }
                    $cols = preg_split('/\s+/', $line);
                    if (count($cols) < 3 || !ctype_digit($cols[0])) {
                        continue;
                    }
                    $rssKb = (int) $cols[1];
                    $cpu = (float) $cols[2];
                    $processes[] = [
                        'pid' => (int) $cols[0],
                        'rss_kb' => $rssKb,
                        'cpu' => $cpu
                    ];
                    $totalMemoryKb += $rssKb;
                    $totalCpu += $cpu;
                }
            }

            return $this->success([
                'available' => $available,
                'stub_status' => $stubStatus,
                'hint' => $hint,
                'processes' => $processes,
                'totals' => [
                    'memory_kb' => $totalMemoryKb,
                    'cpu_percent' => round($totalCpu, 2)
                ]
            ], $available ? 'Nginx metrics retrieved successfully' : 'stub_status not available');

        } catch (\Exception $e) {
            return $this->handleException($e, 'nginx_metrics');
        }
    }

    /**
     * Batch enable/disable/test for multiple sites
     */
    public function batchSites(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'nginx_batch_sites');
        if ($validation) {
            return $validation;
        }

        try {
            $action = $request->input('action');
            $sites = $request->input('sites');

            $allowedActions = ['enable', 'disable', 'test'];
            if (!in_array($action, $allowedActions, true)) {
                return $this->error(
                    'Invalid action. Allowed actions: ' . implode(', ', $allowedActions),
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }

            if (!is_array($sites) || count($sites) === 0) {
                return $this->error(
                    'sites must be a non-empty array of site names',
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }

            if (count($sites) > 100) {
                return $this->error(
                    'Too many sites (max 100 per batch)',
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }

            $results = [];

            if ($action === 'test') {
                // One global config test, reported per site
                $binary = $this->detectNginxBinary();
                if ($binary === null) {
                    return $this->error(self::NGINX_INSTALL_HINT, ServerManagerV1Constants::RESPONSE_BAD_REQUEST);
                }

                $testResult = $this->runConfigTest($binary);
                $message = trim(($testResult['output'] ?? '') . "\n" . ($testResult['error'] ?? ''));

                foreach ($sites as $site) {
                    $results[] = [
                        'site' => is_string($site) ? $site : '',
                        'success' => (bool) $testResult['success'],
                        'message' => $message
                    ];
                }
            } else {
                foreach ($sites as $site) {
                    if (!is_string($site) || trim($site) === ''
                        || strpos($site, '/') !== false || strpos($site, '\\') !== false || strpos($site, '..') !== false
                    ) {
                        $results[] = [
                            'site' => is_string($site) ? $site : '',
                            'success' => false,
                            'message' => 'Invalid site name'
                        ];
                        continue;
                    }

                    $op = $action === 'enable'
                        ? $this->performEnableSite($site)
                        : $this->performDisableSite($site);

                    $results[] = [
                        'site' => $site,
                        'success' => $op['success'],
                        'message' => $op['message']
                    ];
                }
            }

            $succeeded = count(array_filter($results, fn($r) => $r['success']));
            $failed = count($results) - $succeeded;

            Log::info('ServerManagerV1: Nginx batch site action executed', [
                'action' => $action,
                'sites' => count($sites),
                'succeeded' => $succeeded,
                'failed' => $failed,
                'ip' => $request->ip()
            ]);

            return $this->success([
                'action' => $action,
                'results' => $results,
                'succeeded' => $succeeded,
                'failed' => $failed
            ], "Batch '$action' completed: $succeeded succeeded, $failed failed");

        } catch (\Exception $e) {
            return $this->handleException($e, 'nginx_batch_sites');
        }
    }

    /**
     * Parse a backup file name into site + type.
     * Formats: {site}_{Y-m-d_H-i-s}.backup and {site}_deleted_{Y-m-d_H-i-s}.backup
     *
     * @return array{site: string, type: string}
     */
    private function parseBackupFileName(string $name): array
    {
        if (preg_match('/^(.+?)(_deleted)?_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})\.backup$/', $name, $matches)) {
            return [
                'site' => $matches[1],
                'type' => !empty($matches[2]) ? 'delete' : 'update'
            ];
        }

        // Fallback: unknown layout, strip the .backup suffix
        return [
            'site' => preg_replace('/\.backup$/', '', $name),
            'type' => 'update'
        ];
    }

    /**
     * Parse nginx stub_status plain-text output
     */
    private function parseStubStatus(string $body): ?array
    {
        if (!preg_match('/Active connections:\s*(\d+)/i', $body, $active)) {
            return null;
        }

        $accepts = $handled = $requests = null;
        if (preg_match('/^\s*(\d+)\s+(\d+)\s+(\d+)\s*$/m', $body, $counters)) {
            $accepts = (int) $counters[1];
            $handled = (int) $counters[2];
            $requests = (int) $counters[3];
        }

        $reading = $writing = $waiting = null;
        if (preg_match('/Reading:\s*(\d+)\s*Writing:\s*(\d+)\s*Waiting:\s*(\d+)/i', $body, $states)) {
            $reading = (int) $states[1];
            $writing = (int) $states[2];
            $waiting = (int) $states[3];
        }

        return [
            'active_connections' => (int) $active[1],
            'accepts' => $accepts,
            'handled' => $handled,
            'requests' => $requests,
            'reading' => $reading,
            'writing' => $writing,
            'waiting' => $waiting
        ];
    }

    /**
     * Read a certificate's expiry via openssl; returns null on any error
     *
     * @return array{expires_at: string, days_left: int}|null
     */
    private function readCertificateExpiry(string $certPath): ?array
    {
        try {
            $result = ServerManagerV1Utils::executeCommand('openssl', [
                'x509', '-enddate', '-noout', '-in', $certPath
            ], 15);

            if (!$result['success']) {
                return null;
            }

            if (!preg_match('/notAfter=(.+)/', $result['output'] ?? '', $matches)) {
                return null;
            }

            $timestamp = strtotime(trim($matches[1]));
            if ($timestamp === false) {
                return null;
            }

            return [
                'expires_at' => date('c', $timestamp),
                'days_left' => (int) floor(($timestamp - time()) / 86400)
            ];
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * Count site files in a directory (ignores dotfiles)
     */
    private function countSiteFiles(string $path): int
    {
        if ($path === '' || !is_dir($path)) {
            return 0;
        }

        $count = 0;
        $entries = scandir($path);
        if ($entries === false) {
            return 0;
        }

        foreach ($entries as $entry) {
            if ($entry === '' || $entry[0] === '.') {
                continue;
            }
            $fullPath = $path . '/' . $entry;
            if (is_file($fullPath) || is_link($fullPath)) {
                $count++;
            }
        }

        return $count;
    }

    /**
     * Read the last N lines of a file efficiently (block-wise seek from EOF,
     * never loads the whole file into memory).
     *
     * @return string[]
     */
    private function tailFile(string $file, int $lines): array
    {
        $size = filesize($file);
        if ($size === false || $size === 0) {
            return [];
        }

        $handle = fopen($file, 'rb');
        if ($handle === false) {
            return [];
        }

        $chunkSize = 8192;
        $buffer = '';
        $pos = $size;

        // Read 8KB blocks backwards until we have enough newlines or hit BOF
        while ($pos > 0 && substr_count($buffer, "\n") <= $lines) {
            $readSize = (int) min($chunkSize, $pos);
            $pos -= $readSize;
            if (fseek($handle, $pos) !== 0) {
                break;
            }
            $chunk = fread($handle, $readSize);
            if ($chunk === false) {
                break;
            }
            $buffer = $chunk . $buffer;
        }

        fclose($handle);

        $allLines = explode("\n", $buffer);

        // Drop trailing empty element caused by a final newline
        if (end($allLines) === '') {
            array_pop($allLines);
        }

        return array_values(array_slice($allLines, -$lines));
    }

    /**
     * Parse nginx configuration file to extract basic information
     */
    private function parseNginxConfig(string $configFile): array
    {
        $info = [
            'server_names' => [],
            'listen_ports' => [],
            'ssl_enabled' => false,
            'ssl_certificate' => null,
            'root_directory' => null,
            'proxy_pass' => null,
            'config_type' => 'unknown'
        ];

        if (!file_exists($configFile)) {
            return $info;
        }

        $content = file_get_contents($configFile);
        if ($content === false) {
            return $info;
        }

        // Extract server names
        if (preg_match_all('/server_name\s+([^;]+);/', $content, $matches)) {
            foreach ($matches[1] as $serverNames) {
                $names = preg_split('/\s+/', trim($serverNames));
                $info['server_names'] = array_merge($info['server_names'], $names);
            }
        }

        // Extract listen ports
        if (preg_match_all('/listen\s+([^;]+);/', $content, $matches)) {
            foreach ($matches[1] as $listen) {
                $info['listen_ports'][] = trim($listen);
            }
        }

        // Check for SSL
        if (strpos($content, 'ssl_certificate') !== false) {
            $info['ssl_enabled'] = true;

            if (preg_match('/ssl_certificate\s+([^;]+);/', $content, $matches)) {
                $info['ssl_certificate'] = trim($matches[1]);
            }
        }

        // Check for proxy_pass first: a proxy vhost has no web root — any
        // `root` inside it belongs to an ACME/location block, not the site's
        // content, and must not surface as the site's web directory.
        if (preg_match('/proxy_pass\s+([^;]+);/', $content, $matches)) {
            $info['proxy_pass'] = trim($matches[1]);
            $info['config_type'] = 'proxy';
        } elseif (strpos($content, 'fastcgi_pass') !== false) {
            $info['config_type'] = 'php';
        }

        // Extract root directory
        if ($info['config_type'] !== 'proxy' && preg_match('/root\s+([^;]+);/', $content, $matches)) {
            $info['root_directory'] = trim($matches[1]);
            if ($info['config_type'] === 'unknown') {
                $info['config_type'] = 'static';
            }
        }

        return $info;
    }

    /**
     * Generate nginx configuration based on site type. Delegates to the
     * shared ServerManagerV1NginxConfigBuilder (modern HTTP/3 + TLS 1.3
     * early-data stanza). When $sslEnabled is true the builder emits the
     * 443 listeners with Let's Encrypt certificate paths.
     */
    private function generateNginxConfig(string $domain, string $siteType, array $config, bool $sslEnabled = false): string
    {
        if ($sslEnabled) {
            $config['cert_paths'] = [
                'cert' => ServerManagerV1PathConfig::getLetsEncryptCertPath($domain),
                'key' => ServerManagerV1PathConfig::getLetsEncryptKeyPath($domain),
            ];
        }

        return ServerManagerV1NginxConfigBuilder::build($domain, $siteType, $config, $sslEnabled);
    }
}
