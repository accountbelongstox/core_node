<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Controllers;

use App\Apps\ServerManagerV1\ServerManagerV1Gvar\ServerManagerV1Constants;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1Utils;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1SSLConfigReader;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class ServerManagerV1NginxManagerCtl extends ServerManagerV1BaseCtl
{
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
                        
                        $sites[] = $siteInfo;
                    }
                }
            }
            
            // Sort by name
            usort($sites, function($a, $b) {
                return strcmp($a['name'], $b['name']);
            });
            
            return $this->successResponse([
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

            // Validate required parameters
            if (empty($siteName) || empty($domain)) {
                return $this->errorResponse('site_name and domain are required');
            }

            $nginxPaths = ServerManagerV1SSLConfigReader::getNginxPaths();
            $configFile = $nginxPaths['config_path'] . '/' . $siteName;

            // Check if site already exists
            if (file_exists($configFile)) {
                return $this->errorResponse("Site already exists: $siteName", ServerManagerV1Constants::RESPONSE_CONFLICT);
            }

            // Generate nginx configuration based on site type
            $nginxConfig = $this->generateNginxConfig($domain, $siteType, $config);

            // Write configuration file
            if (file_put_contents($configFile, $nginxConfig) === false) {
                return $this->errorResponse("Failed to create site configuration: $siteName", ServerManagerV1Constants::RESPONSE_INTERNAL_ERROR);
            }

            // Test nginx configuration
            $testResult = ServerManagerV1Utils::executeCommand('nginx', ['-t']);
            if (!$testResult['success']) {
                // Remove the invalid configuration file
                unlink($configFile);
                return $this->errorResponse('Invalid nginx configuration: ' . $testResult['error'], ServerManagerV1Constants::RESPONSE_BAD_REQUEST);
            }

            Log::info('ServerManagerV1: Nginx site created', [
                'site_name' => $siteName,
                'domain' => $domain,
                'type' => $siteType,
                'ip' => $request->ip()
            ]);

            return $this->successResponse([
                'site_name' => $siteName,
                'domain' => $domain,
                'type' => $siteType,
                'config_file' => $configFile,
                'enabled' => false
            ], 'Site created successfully');

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
                return $this->errorResponse(
                    "Site configuration not found: $siteName",
                    ServerManagerV1Constants::RESPONSE_NOT_FOUND
                );
            }
            
            $content = file_get_contents($configFile);
            if ($content === false) {
                return $this->errorResponse(
                    "Failed to read site configuration: $siteName",
                    ServerManagerV1Constants::RESPONSE_INTERNAL_ERROR
                );
            }
            
            $configInfo = $this->parseNginxConfig($configFile);
            $isEnabled = is_link($nginxPaths['enabled_path'] . '/' . $siteName);
            
            return $this->successResponse([
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

            if (empty($siteConfig)) {
                return $this->errorResponse('site_config is required');
            }

            $nginxPaths = ServerManagerV1SSLConfigReader::getNginxPaths();
            $configFile = $nginxPaths['config_path'] . '/' . $siteName;

            // Check if site exists
            if (!file_exists($configFile)) {
                return $this->errorResponse("Site not found: $siteName", ServerManagerV1Constants::RESPONSE_NOT_FOUND);
            }

            // Backup current configuration
            $backupFile = $nginxPaths['backup_path'] . '/' . $siteName . '_' . date('Y-m-d_H-i-s') . '.backup';
            if (!copy($configFile, $backupFile)) {
                return $this->errorResponse("Failed to backup current configuration", ServerManagerV1Constants::RESPONSE_INTERNAL_ERROR);
            }

            // Write new configuration
            if (file_put_contents($configFile, $siteConfig) === false) {
                return $this->errorResponse("Failed to update site configuration: $siteName", ServerManagerV1Constants::RESPONSE_INTERNAL_ERROR);
            }

            // Test nginx configuration
            $testResult = ServerManagerV1Utils::executeCommand('nginx', ['-t']);
            if (!$testResult['success']) {
                // Restore backup if test fails
                copy($backupFile, $configFile);
                return $this->errorResponse('Invalid nginx configuration: ' . $testResult['error'], ServerManagerV1Constants::RESPONSE_BAD_REQUEST);
            }

            Log::info('ServerManagerV1: Nginx site updated', [
                'site_name' => $siteName,
                'backup_file' => $backupFile,
                'ip' => $request->ip()
            ]);

            return $this->successResponse([
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
                return $this->errorResponse("Site not found: $siteName", ServerManagerV1Constants::RESPONSE_NOT_FOUND);
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
                return $this->errorResponse("Failed to delete site configuration: $siteName", ServerManagerV1Constants::RESPONSE_INTERNAL_ERROR);
            }

            Log::info('ServerManagerV1: Nginx site deleted', [
                'site_name' => $siteName,
                'backup_file' => $backupFile,
                'ip' => $request->ip()
            ]);

            return $this->successResponse([
                'site_name' => $siteName,
                'deleted' => true,
                'backup_file' => $backupFile
            ], 'Site deleted successfully');

        } catch (\Exception $e) {
            return $this->handleException($e, 'nginx_delete_site');
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
            $nginxPaths = ServerManagerV1SSLConfigReader::getNginxPaths();
            $availableFile = $nginxPaths['config_path'] . '/' . $siteName;
            $enabledFile = $nginxPaths['enabled_path'] . '/' . $siteName;
            
            if (!file_exists($availableFile)) {
                return $this->errorResponse(
                    "Site configuration not found: $siteName",
                    ServerManagerV1Constants::RESPONSE_NOT_FOUND
                );
            }
            
            if (is_link($enabledFile)) {
                return $this->successResponse([
                    'site_name' => $siteName,
                    'already_enabled' => true
                ], 'Site is already enabled');
            }
            
            // Test nginx configuration before enabling
            $testResult = ServerManagerV1Utils::executeCommand('nginx', ['-t']);
            if (!$testResult['success']) {
                return $this->errorResponse(
                    'Nginx configuration test failed: ' . $testResult['error'],
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }
            
            // Create symlink
            if (!symlink($availableFile, $enabledFile)) {
                return $this->errorResponse(
                    "Failed to enable site: $siteName",
                    ServerManagerV1Constants::RESPONSE_INTERNAL_ERROR
                );
            }
            
            // Test configuration again with new site
            $testResult = ServerManagerV1Utils::executeCommand('nginx', ['-t']);
            if (!$testResult['success']) {
                // Remove the symlink if test fails
                unlink($enabledFile);
                return $this->errorResponse(
                    'Site configuration is invalid: ' . $testResult['error'],
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }
            
            Log::info('ServerManagerV1: Nginx site enabled', [
                'site_name' => $siteName,
                'ip' => $request->ip()
            ]);
            
            return $this->successResponse([
                'site_name' => $siteName,
                'enabled' => true,
                'enabled_file' => $enabledFile
            ], 'Site enabled successfully');
            
        } catch (\Exception $e) {
            return $this->handleException($e, 'nginx_enable_site');
        }
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
            $nginxPaths = ServerManagerV1SSLConfigReader::getNginxPaths();
            $enabledFile = $nginxPaths['enabled_path'] . '/' . $siteName;
            
            if (!is_link($enabledFile)) {
                return $this->successResponse([
                    'site_name' => $siteName,
                    'already_disabled' => true
                ], 'Site is already disabled');
            }
            
            // Remove symlink
            if (!unlink($enabledFile)) {
                return $this->errorResponse(
                    "Failed to disable site: $siteName",
                    ServerManagerV1Constants::RESPONSE_INTERNAL_ERROR
                );
            }
            
            Log::info('ServerManagerV1: Nginx site disabled', [
                'site_name' => $siteName,
                'ip' => $request->ip()
            ]);
            
            return $this->successResponse([
                'site_name' => $siteName,
                'enabled' => false
            ], 'Site disabled successfully');
            
        } catch (\Exception $e) {
            return $this->handleException($e, 'nginx_disable_site');
        }
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
            $result = ServerManagerV1Utils::executeCommand('nginx', ['-t']);
            
            return $this->successResponse([
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
            // Test configuration first
            $testResult = ServerManagerV1Utils::executeCommand('nginx', ['-t']);
            if (!$testResult['success']) {
                return $this->errorResponse(
                    'Cannot reload nginx: configuration test failed - ' . $testResult['error'],
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }
            
            // Reload nginx
            $reloadResult = ServerManagerV1Utils::executeCommand('systemctl', ['reload', 'nginx']);
            
            Log::info('ServerManagerV1: Nginx reload attempted', [
                'success' => $reloadResult['success'],
                'ip' => $request->ip()
            ]);
            
            return $this->successResponse([
                'reloaded' => $reloadResult['success'],
                'output' => $reloadResult['output'],
                'error' => $reloadResult['error'],
                'test_output' => $testResult['output']
            ], $reloadResult['success'] ? 'Nginx reloaded successfully' : 'Nginx reload failed');
            
        } catch (\Exception $e) {
            return $this->handleException($e, 'nginx_reload');
        }
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

        // Extract root directory
        if (preg_match('/root\s+([^;]+);/', $content, $matches)) {
            $info['root_directory'] = trim($matches[1]);
        }

        // Check for proxy_pass
        if (preg_match('/proxy_pass\s+([^;]+);/', $content, $matches)) {
            $info['proxy_pass'] = trim($matches[1]);
            $info['config_type'] = 'proxy';
        } elseif (strpos($content, 'fastcgi_pass') !== false) {
            $info['config_type'] = 'php';
        } elseif ($info['root_directory']) {
            $info['config_type'] = 'static';
        }

        return $info;
    }

    /**
     * Generate nginx configuration based on site type
     */
    private function generateNginxConfig(string $domain, string $siteType, array $config): string
    {
        // Use PathMapper for environment-aware path (no hardcoded paths)
        $wwwroot = \App\Providers\PathMapper::mapWebPath('wwwroot');
        $wwwDir = $config['www_dir'] ?? "$wwwroot/$domain";
        $phpVersion = $config['php_version'] ?? '8.2';
        $proxyTarget = $config['proxy_target'] ?? null;

        switch ($siteType) {
            case 'laravel':
                return $this->generateLaravelConfig($domain, $wwwDir . '/public', $phpVersion);

            case 'static':
                return $this->generateStaticConfig($domain, $wwwDir);

            case 'proxy':
                if (!$proxyTarget) {
                    throw new \InvalidArgumentException('proxy_target is required for proxy site type');
                }
                return $this->generateProxyConfig($domain, $proxyTarget);

            case 'php':
                return $this->generatePhpConfig($domain, $wwwDir, $phpVersion);

            default:
                throw new \InvalidArgumentException("Unsupported site type: $siteType");
        }
    }

    /**
     * Generate Laravel nginx configuration
     */
    private function generateLaravelConfig(string $domain, string $wwwDir, string $phpVersion): string
    {
        return "server {
    listen 80;
    listen [::]:80;
    server_name $domain;
    root $wwwDir;

    add_header X-Frame-Options \"SAMEORIGIN\";
    add_header X-Content-Type-Options \"nosniff\";

    index index.php;

    charset utf-8;

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \\.php\$ {
        fastcgi_pass unix:/var/run/php/php$phpVersion-fpm.sock;
        fastcgi_param SCRIPT_FILENAME \$realpath_root\$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\\.(?!well-known).* {
        deny all;
    }
}";
    }

    /**
     * Generate static site nginx configuration
     */
    private function generateStaticConfig(string $domain, string $wwwDir): string
    {
        return "server {
    listen 80;
    listen [::]:80;
    server_name $domain;
    root $wwwDir;

    index index.html index.htm;

    location / {
        try_files \$uri \$uri/ =404;
    }

    location ~* \\.(css|js|png|jpg|jpeg|gif|ico|svg)\$ {
        expires 1y;
        add_header Cache-Control \"public, immutable\";
    }
}";
    }

    /**
     * Generate proxy nginx configuration
     */
    private function generateProxyConfig(string $domain, string $proxyTarget): string
    {
        return "server {
    listen 80;
    listen [::]:80;
    server_name $domain;

    location / {
        proxy_pass $proxyTarget;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}";
    }

    /**
     * Generate PHP nginx configuration
     */
    private function generatePhpConfig(string $domain, string $wwwDir, string $phpVersion): string
    {
        return "server {
    listen 80;
    listen [::]:80;
    server_name $domain;
    root $wwwDir;

    index index.php index.html index.htm;

    location / {
        try_files \$uri \$uri/ =404;
    }

    location ~ \\.php\$ {
        fastcgi_pass unix:/var/run/php/php$phpVersion-fpm.sock;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\\.ht {
        deny all;
    }
}";
    }
}
