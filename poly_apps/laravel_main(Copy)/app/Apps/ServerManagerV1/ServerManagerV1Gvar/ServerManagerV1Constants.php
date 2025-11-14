<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Gvar;

use App\Providers\PathMapper;
use App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig;

class ServerManagerV1Constants
{
    // Application Information
    public const APP_NAME = 'ServerManagerV1';
    public const APP_VERSION = '1.0.0';
    public const API_PREFIX = 'servermanager/v1';
    
    // Security Configuration
    public const MAX_FILE_DOWNLOAD_SIZE = 104857600; // 100MB
    public const MAX_EXECUTION_TIME = 300; // 5 minutes
    public const MAX_LOG_ENTRIES = 1000;
    
    /**
     * Get allowed download paths (environment-aware)
     * @return array
     */
    public static function getAllowedDownloadPaths(): array
    {
        return [
            PathMapper::mapWebPath('wwwroot') . '/core_node/scripts',
            PathMapper::mapWebPath('wwwroot') . '/core_node/poly_apps',
            PathMapper::mapWebPath('laravel_data_dir'),
            '/var/log',
            PathMapper::mapWebPath('nginx'),
            PathMapper::mapWebPath('nginxconfig'),
            PathMapper::mapWebPath('shared-data'),
            ServerManagerV1PathConfig::getLetsEncryptDir(),
            PathMapper::getLaravelTmpDir()
        ];
    }
    
    /** @deprecated Use getAllowedDownloadPaths() instead */
    public const ALLOWED_DOWNLOAD_PATHS = [];
    
    // Predefined Script Categories
    public const SCRIPT_CATEGORIES = [
        'system_maintenance' => 'System Maintenance',
        'log_rotation' => 'Log Rotation',
        'backup' => 'Backup Operations',
        'update' => 'System Updates',
        'diagnostic' => 'System Diagnostics',
        'unified_manager' => 'Unified Manager Operations'
    ];
    
    /**
     * Get nginx configuration paths (environment-aware)
     * @return array
     */
    public static function getNginxPaths(): array
    {
        $nginxConfigDir = PathMapper::mapWebPath('nginxconfig');
        return [
            'main_config' => PathMapper::mapWebPath('nginx') . '/nginx.conf',
            'sites_available' => $nginxConfigDir . '/sites-available',
            'sites_enabled' => $nginxConfigDir . '/sites-enabled',
            'conf_d' => $nginxConfigDir . '/conf.d',
            'log_dir' => '/var/log/nginx'
        ];
    }
    
    /** @deprecated Use getNginxPaths() instead */
    public const NGINX_PATHS = [];
    
    /**
     * Get SSL certificate paths (environment-aware)
     * @return array
     */
    public static function getSslPaths(): array
    {
        $letsencryptDir = ServerManagerV1PathConfig::getLetsEncryptDir();
        return [
            'letsencrypt_dir' => $letsencryptDir,
            'live_certs' => $letsencryptDir . '/live',
            'archive_certs' => $letsencryptDir . '/archive',
            'renewal_configs' => $letsencryptDir . '/renewal'
        ];
    }
    
    /** @deprecated Use getSslPaths() instead */
    public const SSL_PATHS = [];
    
    /**
     * Get system directories (environment-aware)
     * @return array
     */
    public static function getSystemDirs(): array
    {
        $wwwroot = PathMapper::mapWebPath('wwwroot');
        $coreNodeDir = PathMapper::getCoreNodeDir();
        return [
            'unified_manager' => $coreNodeDir ? $coreNodeDir . '/scripts/unified_manager' : $wwwroot . '/core_node/scripts/unified_manager',
            'install_scripts' => $coreNodeDir ? $coreNodeDir . '/scripts/shells/linux/debian/install_shells' : $wwwroot . '/core_node/scripts/shells/linux/debian/install_shells',
            'laravel_db' => PathMapper::mapWebPath('laravel_data_dir'),
            'laravel_storage' => $coreNodeDir ? $coreNodeDir . '/poly_apps/laravel_main/storage' : $wwwroot . '/core_node/poly_apps/laravel_main/storage',
            'laravel_public' => $coreNodeDir ? $coreNodeDir . '/poly_apps/laravel_main/public' : $wwwroot . '/core_node/poly_apps/laravel_main/public'
        ];
    }
    
    /** @deprecated Use getSystemDirs() instead */
    public const SYSTEM_DIRS = [];
    
    // API Response Codes
    public const RESPONSE_SUCCESS = 200;
    public const RESPONSE_CREATED = 201;
    public const RESPONSE_BAD_REQUEST = 400;
    public const RESPONSE_UNAUTHORIZED = 401;
    public const RESPONSE_FORBIDDEN = 403;
    public const RESPONSE_NOT_FOUND = 404;
    public const RESPONSE_INTERNAL_ERROR = 500;
    
    // Authentication
    public const AUTH_HEADER = 'X-Server-Manager-Key';
    public const SESSION_TIMEOUT = 3600; // 1 hour
    
    // Rate Limiting
    public const RATE_LIMIT_REQUESTS = 100;
    public const RATE_LIMIT_MINUTES = 60;
    
    // File Types
    public const ALLOWED_PREVIEW_EXTENSIONS = [
        'txt', 'log', 'conf', 'config', 'json', 'xml', 'yml', 'yaml',
        'php', 'js', 'css', 'html', 'md', 'sh', 'py', 'sql'
    ];
    
    // System Commands (Hardcoded for Security)
    public const SYSTEM_COMMANDS = [
        'nginx_test' => 'nginx -t',
        'nginx_reload' => 'systemctl reload nginx',
        'nginx_restart' => 'systemctl restart nginx',
        'nginx_status' => 'systemctl status nginx',
        'certbot_renew' => 'certbot renew --quiet',
        'system_info' => 'uname -a',
        'disk_usage' => 'df -h',
        'memory_info' => 'free -h',
        'process_list' => 'ps aux'
    ];
    
    /**
     * Get unified manager scripts paths (environment-aware)
     * @return array
     */
    public static function getUnifiedManagerScripts(): array
    {
        $coreNodeDir = PathMapper::getCoreNodeDir();
        $unifiedManagerDir = $coreNodeDir ? $coreNodeDir . '/scripts/unified_manager' : PathMapper::mapWebPath('wwwroot') . '/core_node/scripts/unified_manager';
        return [
            'deploy_apps' => $unifiedManagerDir . '/deploy_apps.sh',
            'build_apps' => $unifiedManagerDir . '/build_apps.sh',
            'start_apps' => $unifiedManagerDir . '/start_apps.sh',
            'app_registry' => $unifiedManagerDir . '/app_registry.json'
        ];
    }
    
    /** @deprecated Use getUnifiedManagerScripts() instead */
    public const UNIFIED_MANAGER_SCRIPTS = [];
    
    /**
     * Get certbot installation script path (environment-aware)
     * @return string
     */
    public static function getCertbotInstallScript(): string
    {
        $coreNodeDir = PathMapper::getCoreNodeDir();
        return $coreNodeDir ? $coreNodeDir . '/scripts/shells/linux/debian/install_shells/26_install_certbot.sh' : PathMapper::mapWebPath('wwwroot') . '/core_node/scripts/shells/linux/debian/install_shells/26_install_certbot.sh';
    }
    
    /** @deprecated Use getCertbotInstallScript() instead */
    public const CERTBOT_INSTALL_SCRIPT = '';
}
