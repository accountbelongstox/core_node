<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Config;

/**
 * ServerManagerV1 Path Configuration
 * 
 * IMPORTANT FOR AI DEVELOPERS:
 * This class centralizes all path constants used throughout the ServerManagerV1 system.
 * When modifying any path-related functionality, ALWAYS update the constants here first,
 * then use these constants throughout the codebase instead of hardcoded paths.
 * 
 * This prevents path inconsistencies and makes future path changes easier to manage.
 * 
 * Usage: ServerManagerV1PathConfig::NGINX_SITES_AVAILABLE
 */
class ServerManagerV1PathConfig
{
    // ==========================================
    // NGINX CONFIGURATION PATHS
    // ==========================================
    
    /** Main nginx configuration directory */
    public const NGINX_CONFIG_DIR = '/www/nginxconfig';
    
    /** Nginx sites-available directory */
    public const NGINX_SITES_AVAILABLE = '/www/nginxconfig/sites-available';
    
    /** Nginx sites-enabled directory */
    public const NGINX_SITES_ENABLED = '/www/nginxconfig/sites-enabled';
    
    /** Nginx configuration snippets directory */
    public const NGINX_CONF_D = '/www/nginxconfig/conf.d';
    
    /** Main nginx configuration file */
    public const NGINX_MAIN_CONFIG = '/etc/nginx/nginx.conf';
    
    // ==========================================
    // SSL CERTIFICATE PATHS
    // ==========================================
    
    /** SSL certificates base directory */
    public const SSL_BASE_DIR = '/www/nginxconfig/ssl';
    
    /** SSL credentials directory for DNS providers */
    public const SSL_CREDENTIALS_DIR = '/www/nginxconfig/ssl/credentials';
    
    // ==========================================
    // WEB ROOT PATHS
    // ==========================================
    
    /** Main web root directory */
    public const WWW_ROOT = '/www/wwwroot';
    
    /** Default website directory */
    public const DEFAULT_SITE_DIR = '/www/wwwroot/default';
    
    // ==========================================
    // LARAVEL APPLICATION PATHS
    // ==========================================
    
    /** Laravel application base directory (will be set dynamically) */
    public const LARAVEL_BASE_DIR = '/mnt/d/programing/core_node/poly_apps/laravel_main';
    
    /** Laravel public directory */
    public const LARAVEL_PUBLIC_DIR = '/mnt/d/programing/core_node/poly_apps/laravel_main/public';
    
    // ==========================================
    // DATA STORAGE PATHS
    // ==========================================
    
    /** Shared data directory */
    public const SHARED_DATA_DIR = '/www/shared-data';
    
    /** SSL configuration JSON file */
    public const SSL_CONFIG_FILE = '/www/shared-data/ssl/ssl_config.json';
    
    /** Domain configuration JSON file */
    public const DOMAIN_CONFIG_FILE = '/www/shared-data/domains/domains_config.json';
    
    /** Certificate configuration JSON file */
    public const CERTIFICATE_CONFIG_FILE = '/www/shared-data/ssl/certificates_config.json';
    
    // ==========================================
    // LOG PATHS
    // ==========================================
    
    /** Nginx log directory */
    public const NGINX_LOG_DIR = '/var/log/nginx';
    
    /** ServerManager log directory */
    public const SERVERMANAGER_LOG_DIR = '/var/log/servermanager';
    
    // ==========================================
    // BACKUP PATHS
    // ==========================================
    
    /** Nginx configuration backup directory */
    public const NGINX_BACKUP_DIR = '/www/backup/nginx-configs';
    
    /** SSL certificate backup directory */
    public const SSL_BACKUP_DIR = '/www/backup/ssl-certs';
    
    // ==========================================
    // HELPER METHODS
    // ==========================================
    
    /**
     * Get SSL certificate directory for a specific domain
     * 
     * @param string $domain The domain name
     * @return string The SSL certificate directory path
     */
    public static function getSslCertDir(string $domain): string
    {
        $cleanDomain = trim(preg_replace('/[\r\n\t]/', '', $domain));
        return self::SSL_BASE_DIR . '/' . $cleanDomain;
    }
    
    /**
     * Get website directory for a specific domain
     * 
     * @param string $domain The domain name
     * @return string The website directory path
     */
    public static function getWebsiteDir(string $domain): string
    {
        return self::WWW_ROOT . '/' . $domain;
    }
    
    /**
     * Get nginx site configuration file path
     * 
     * @param string $domain The domain name
     * @param bool $ssl Whether this is an SSL configuration
     * @return string The configuration file path
     */
    public static function getNginxSiteConfig(string $domain, bool $ssl = false): string
    {
        $suffix = $ssl ? '-ssl' : '';
        return self::NGINX_SITES_AVAILABLE . '/' . $domain . $suffix;
    }
    
    /**
     * Get nginx enabled site link path
     * 
     * @param string $domain The domain name
     * @return string The enabled site link path
     */
    public static function getNginxEnabledSite(string $domain): string
    {
        return self::NGINX_SITES_ENABLED . '/' . $domain;
    }
    
    /**
     * Get all required directories that should be created
     * 
     * @return array Array of directory paths
     */
    public static function getRequiredDirectories(): array
    {
        return [
            self::NGINX_CONFIG_DIR,
            self::NGINX_SITES_AVAILABLE,
            self::NGINX_SITES_ENABLED,
            self::NGINX_CONF_D,
            self::SSL_BASE_DIR,
            self::SSL_CREDENTIALS_DIR,
            self::WWW_ROOT,
            self::DEFAULT_SITE_DIR,
            self::SHARED_DATA_DIR,
            dirname(self::SSL_CONFIG_FILE),
            dirname(self::DOMAIN_CONFIG_FILE),
            dirname(self::CERTIFICATE_CONFIG_FILE),
            self::NGINX_LOG_DIR,
            self::SERVERMANAGER_LOG_DIR,
            self::NGINX_BACKUP_DIR,
            self::SSL_BACKUP_DIR,
        ];
    }
    
    /**
     * Validate that all required directories exist
     * 
     * @return array Array of missing directories
     */
    public static function validateDirectories(): array
    {
        $missing = [];
        foreach (self::getRequiredDirectories() as $dir) {
            if (!is_dir($dir)) {
                $missing[] = $dir;
            }
        }
        return $missing;
    }
}
