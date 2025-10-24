<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Config;

use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1PathResolver;

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
 *
 * NOTE: This class now uses ServerManagerV1PathResolver for environment-aware paths.
 * Paths are resolved dynamically based on environment (WSL/Production).
 */
class ServerManagerV1PathConfig
{
    // ==========================================
    // NGINX CONFIGURATION PATHS (ENVIRONMENT-AWARE)
    // ==========================================

    /**
     * Get main nginx configuration directory (environment-aware)
     */
    public static function getNginxConfigDir(): string
    {
        return ServerManagerV1PathResolver::mapWebPath('/www/nginxconfig');
    }

    /**
     * Get nginx sites-available directory (environment-aware)
     */
    public static function getNginxSitesAvailable(): string
    {
        return ServerManagerV1PathResolver::mapWebPath('/www/nginxconfig/sites-available');
    }

    /**
     * Get nginx sites-enabled directory (environment-aware)
     */
    public static function getNginxSitesEnabled(): string
    {
        return ServerManagerV1PathResolver::mapWebPath('/www/nginxconfig/sites-enabled');
    }

    /** Legacy constants - DEPRECATED: Use getter methods instead */
    public const NGINX_CONFIG_DIR = '/www/nginxconfig';
    public const NGINX_SITES_AVAILABLE = '/www/nginxconfig/sites-available';
    public const NGINX_SITES_ENABLED = '/www/nginxconfig/sites-enabled';
    public const NGINX_CONF_D = '/www/nginxconfig/conf.d';
    public const NGINX_MAIN_CONFIG = '/etc/nginx/nginx.conf';

    // ==========================================
    // SSL CERTIFICATE PATHS (ENVIRONMENT-AWARE)
    // ==========================================

    /**
     * Get SSL base directory (environment-aware)
     */
    public static function getSslBaseDir(): string
    {
        return ServerManagerV1PathResolver::mapWebPath('/www/nginxconfig/ssl');
    }

    /**
     * Get SSL credentials directory (environment-aware)
     */
    public static function getSslCredentialsDir(): string
    {
        return ServerManagerV1PathResolver::mapWebPath('/www/nginxconfig/ssl/credentials');
    }

    /** Legacy constants - DEPRECATED: Use getter methods instead */
    public const SSL_BASE_DIR = '/www/nginxconfig/ssl';
    public const SSL_CREDENTIALS_DIR = '/www/nginxconfig/ssl/credentials';

    // ==========================================
    // WEB ROOT PATHS (ENVIRONMENT-AWARE)
    // ==========================================

    /**
     * Get main web root directory (environment-aware)
     * Returns: /www/wwwroot (production) or /mnt/d/www/wwwroot (WSL)
     */
    public static function getWwwRoot(): string
    {
        return ServerManagerV1PathResolver::resolveWebRoot();
    }

    /**
     * Get default website directory (environment-aware)
     */
    public static function getDefaultSiteDir(): string
    {
        return self::getWwwRoot() . '/default';
    }

    // Legacy constants for backwards compatibility
    // DEPRECATED: Use getWwwRoot() instead
    public const WWW_ROOT = '/www/wwwroot';
    public const DEFAULT_SITE_DIR = '/www/wwwroot/default';

    // ==========================================
    // LARAVEL APPLICATION PATHS (ENVIRONMENT-AWARE)
    // ==========================================

    /**
     * Get Laravel base directory (environment-aware)
     * Calculates relative to core_node root
     */
    public static function getLaravelBaseDir(): string
    {
        return ServerManagerV1PathResolver::getCoreNodePath() . '/poly_apps/laravel_main';
    }

    /**
     * Get Laravel public directory (environment-aware)
     */
    public static function getLaravelPublicDir(): string
    {
        return self::getLaravelBaseDir() . '/public';
    }

    // Legacy constants for backwards compatibility
    // DEPRECATED: Use getLaravelBaseDir() instead
    public const LARAVEL_BASE_DIR = '/mnt/d/programing/core_node/poly_apps/laravel_main';
    public const LARAVEL_PUBLIC_DIR = '/mnt/d/programing/core_node/poly_apps/laravel_main/public';

    // ==========================================
    // DATA STORAGE PATHS (ENVIRONMENT-AWARE)
    // ==========================================

    /**
     * Get shared data directory (environment-aware)
     */
    public static function getSharedDataDir(): string
    {
        return ServerManagerV1PathResolver::mapWebPath('/www/shared-data');
    }

    /**
     * Get SSL configuration JSON file path (environment-aware)
     */
    public static function getSslConfigFile(): string
    {
        return ServerManagerV1PathResolver::mapWebPath('/www/shared-data/ssl/ssl_config.json');
    }

    /**
     * Get domain configuration JSON file path (environment-aware)
     */
    public static function getDomainConfigFile(): string
    {
        return ServerManagerV1PathResolver::mapWebPath('/www/shared-data/domains/domains_config.json');
    }

    /**
     * Get certificate configuration JSON file path (environment-aware)
     */
    public static function getCertificateConfigFile(): string
    {
        return ServerManagerV1PathResolver::mapWebPath('/www/shared-data/ssl/certificates_config.json');
    }

    /** Legacy constants - DEPRECATED: Use getter methods instead */
    public const SHARED_DATA_DIR = '/www/shared-data';
    public const SSL_CONFIG_FILE = '/www/shared-data/ssl/ssl_config.json';
    public const DOMAIN_CONFIG_FILE = '/www/shared-data/domains/domains_config.json';
    public const CERTIFICATE_CONFIG_FILE = '/www/shared-data/ssl/certificates_config.json';

    // ==========================================
    // LOG PATHS
    // ==========================================

    /** Nginx log directory */
    public const NGINX_LOG_DIR = '/var/log/nginx';

    /** ServerManager log directory */
    public const SERVERMANAGER_LOG_DIR = '/var/log/servermanager';

    // ==========================================
    // BACKUP PATHS (ENVIRONMENT-AWARE)
    // ==========================================

    /**
     * Get nginx configuration backup directory (environment-aware)
     */
    public static function getNginxBackupDir(): string
    {
        return ServerManagerV1PathResolver::mapWebPath('/www/backup/nginx-configs');
    }

    /**
     * Get SSL certificate backup directory (environment-aware)
     */
    public static function getSslBackupDir(): string
    {
        return ServerManagerV1PathResolver::mapWebPath('/www/backup/ssl-certs');
    }

    /** Legacy constants - DEPRECATED: Use getter methods instead */
    public const NGINX_BACKUP_DIR = '/www/backup/nginx-configs';
    public const SSL_BACKUP_DIR = '/www/backup/ssl-certs';

    // ==========================================
    // HELPER METHODS
    // ==========================================

    /**
     * Get SSL certificate directory for a specific domain (environment-aware)
     *
     * @param string $domain The domain name
     * @return string The SSL certificate directory path
     */
    public static function getSslCertDir(string $domain): string
    {
        $cleanDomain = trim(preg_replace('/[\r\n\t]/', '', $domain));
        $basePath = self::getSslBaseDir();
        return $basePath . '/' . $cleanDomain;
    }

    /**
     * Get website directory for a specific domain (environment-aware)
     *
     * @param string $domain The domain name
     * @return string The website directory path
     */
    public static function getWebsiteDir(string $domain): string
    {
        return self::getWwwRoot() . '/' . $domain;
    }

    /**
     * Get nginx site configuration file path (environment-aware)
     *
     * @param string $domain The domain name
     * @param bool $ssl Whether this is an SSL configuration
     * @return string The configuration file path
     */
    public static function getNginxSiteConfig(string $domain, bool $ssl = false): string
    {
        $suffix = $ssl ? '-ssl' : '';
        $sitesAvailable = self::getNginxSitesAvailable();
        return $sitesAvailable . '/' . $domain . $suffix;
    }

    /**
     * Get nginx enabled site link path (environment-aware)
     *
     * @param string $domain The domain name
     * @return string The enabled site link path
     */
    public static function getNginxEnabledSite(string $domain): string
    {
        $sitesEnabled = self::getNginxSitesEnabled();
        return $sitesEnabled . '/' . $domain;
    }

    /**
     * Get all required directories that should be created (environment-aware)
     *
     * @return array Array of directory paths
     */
    public static function getRequiredDirectories(): array
    {
        return [
            self::getNginxConfigDir(),
            self::getNginxSitesAvailable(),
            self::getNginxSitesEnabled(),
            ServerManagerV1PathResolver::mapWebPath('/www/nginxconfig/conf.d'),
            self::getSslBaseDir(),
            self::getSslCredentialsDir(),
            self::getWwwRoot(),
            self::getDefaultSiteDir(),
            self::getSharedDataDir(),
            dirname(self::getSslConfigFile()),
            dirname(self::getDomainConfigFile()),
            dirname(self::getCertificateConfigFile()),
            self::NGINX_LOG_DIR,
            self::SERVERMANAGER_LOG_DIR,
            self::getNginxBackupDir(),
            self::getSslBackupDir(),
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
