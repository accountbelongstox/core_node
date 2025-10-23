<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Gvar;

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
    
    // File Access Whitelist (Hardcoded Security)
    public const ALLOWED_DOWNLOAD_PATHS = [
        '/www/wwwroot/core_node/scripts',
        '/www/wwwroot/core_node/poly_apps',
        '/www/wwwroot/laravel_main/laravel_db',
        '/var/log',
        '/etc/nginx',
        '/www/nginxconfig',
        '/www/shared-data',
        '/etc/letsencrypt',
        '/tmp'
    ];
    
    // Predefined Script Categories
    public const SCRIPT_CATEGORIES = [
        'system_maintenance' => 'System Maintenance',
        'log_rotation' => 'Log Rotation',
        'backup' => 'Backup Operations',
        'update' => 'System Updates',
        'diagnostic' => 'System Diagnostics',
        'unified_manager' => 'Unified Manager Operations'
    ];
    
    // Nginx Configuration Paths
    public const NGINX_PATHS = [
        'main_config' => '/etc/nginx/nginx.conf',
        'sites_available' => '/www/nginxconfig/sites-available',
        'sites_enabled' => '/www/nginxconfig/sites-enabled',
        'conf_d' => '/www/nginxconfig/conf.d',
        'log_dir' => '/var/log/nginx'
    ];
    
    // SSL Certificate Paths
    public const SSL_PATHS = [
        'letsencrypt_dir' => '/etc/letsencrypt',
        'live_certs' => '/etc/letsencrypt/live',
        'archive_certs' => '/etc/letsencrypt/archive',
        'renewal_configs' => '/etc/letsencrypt/renewal'
    ];
    
    // System Directories
    public const SYSTEM_DIRS = [
        'unified_manager' => '/www/wwwroot/core_node/scripts/unified_manager',
        'install_scripts' => '/www/wwwroot/core_node/scripts/shells/linux/debian/install_shells',
        'laravel_db' => '/www/wwwroot/laravel_main/laravel_db',
        'laravel_storage' => '/www/wwwroot/core_node/poly_apps/laravel_main/storage',
        'laravel_public' => '/www/wwwroot/core_node/poly_apps/laravel_main/public'
    ];
    
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
    
    // Unified Manager Scripts (Hardcoded Paths)
    public const UNIFIED_MANAGER_SCRIPTS = [
        'deploy_apps' => '/www/wwwroot/core_node/scripts/unified_manager/deploy_apps.sh',
        'build_apps' => '/www/wwwroot/core_node/scripts/unified_manager/build_apps.sh',
        'start_apps' => '/www/wwwroot/core_node/scripts/unified_manager/start_apps.sh',
        'app_registry' => '/www/wwwroot/core_node/scripts/unified_manager/app_registry.json'
    ];
    
    // Certbot Installation Script
    public const CERTBOT_INSTALL_SCRIPT = '/www/wwwroot/core_node/scripts/shells/linux/debian/install_shells/26_install_certbot.sh';
}
