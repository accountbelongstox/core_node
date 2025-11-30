<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Config;

use App\Providers\PathMapper;

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
 * NOTE: This class now uses PathMapper for environment-aware paths.
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
        return PathMapper::mapWebPath('nginxconfig');
    }

    /**
     * Get nginx sites-available directory (environment-aware)
     */
    public static function getNginxSitesAvailable(): string
    {
        return PathMapper::mapWebPath('nginxconfig') . '/sites-available';
    }

    /**
     * Get nginx sites-enabled directory (environment-aware)
     */
    public static function getNginxSitesEnabled(): string
    {
        return PathMapper::mapWebPath('nginxconfig') . '/sites-enabled';
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
        return PathMapper::mapWebPath('nginxconfig') . '/ssl';
    }

    /**
     * Get SSL credentials directory (environment-aware)
     */
    public static function getSslCredentialsDir(): string
    {
        return PathMapper::mapWebPath('nginxconfig') . '/ssl/credentials';
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
        return PathMapper::mapWebPath('wwwroot');
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
     * Uses PathMapper::getLaravelMainDir() for relative positioning from PathMapper file
     * 
     * IMPORTANT: This method uses relative positioning, not hardcoded paths.
     * PathMapper::getLaravelMainDir() calculates the path relative to PathMapper.php location.
     */
    public static function getLaravelBaseDir(): string
    {
        return \App\Providers\PathMapper::getLaravelMainDir();
    }

    /**
     * Get Laravel public directory (environment-aware)
     * Uses PathMapper::getLaravelMainPublicDir() for relative positioning
     */
    public static function getLaravelPublicDir(): string
    {
        return \App\Providers\PathMapper::getLaravelMainPublicDir();
    }

    // Legacy constants for backwards compatibility
    // DEPRECATED: Use getLaravelBaseDir() instead
    // NOTE: These constants are deprecated and should use PathMapper for environment-aware paths
    // The paths below are examples only - actual paths depend on environment (WSL/Production)
    // WSL: /mnt/d/programing/core_node/poly_apps/laravel_main
    // Production: /www/programing/core_node/poly_apps/laravel_main
    // Use getLaravelBaseDir() method instead which uses PathMapper
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
        return PathMapper::mapWebPath('shared-data');
    }

    /**
     * Get SSL configuration JSON file path (environment-aware)
     */
    public static function getSslConfigFile(): string
    {
        return PathMapper::mapWebPath('shared-data') . '/ssl/ssl_config.json';
    }

    /**
     * Get domain configuration JSON file path (environment-aware)
     */
    public static function getDomainConfigFile(): string
    {
        return PathMapper::mapWebPath('shared-data') . '/domains/domains_config.json';
    }

    /**
     * Get certificate configuration JSON file path (environment-aware)
     */
    public static function getCertificateConfigFile(): string
    {
        return PathMapper::mapWebPath('shared-data') . '/ssl/certificates_config.json';
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
        return PathMapper::mapWebPath('backup') . '/nginx-configs';
    }

    /**
     * Get SSL certificate backup directory (environment-aware)
     */
    public static function getSslBackupDir(): string
    {
        return PathMapper::mapWebPath('backup') . '/ssl-certs';
    }

    /** Legacy constants - DEPRECATED: Use getter methods instead */
    public const NGINX_BACKUP_DIR = '/www/backup/nginx-configs';
    public const SSL_BACKUP_DIR = '/www/backup/ssl-certs';

    // ==========================================
    // WEBSITE TYPE TO PATH MAPPING
    // ==========================================

    /**
     * Get directory path for website type
     *
     * @param string $type Website type (laravel, poly, html, php)
     * @param string|null $domain Domain name (for html/php types)
     * @return string Directory path
     */
    public static function getPathForType(string $type, ?string $domain = null): string
    {
        return match($type) {
            'laravel', 'poly' => PathMapper::getLaravelMainDir(),
            'html', 'php' => PathMapper::getWwwRoot() . '/' . ($domain ?? 'default'),
            default => throw new \InvalidArgumentException("Unknown website type: $type")
        };
    }

    /**
     * Get available website types
     *
     * @return array List of available types with descriptions
     */
    public static function getAvailableTypes(): array
    {
        return [
            'laravel' => 'Laravel application (poly_apps/laravel_main)',
            'poly' => 'Poly application (alias for laravel)',
            'html' => 'Static HTML website',
            'php' => 'PHP website'
        ];
    }

    // ==========================================
    // PHP MODE HELPERS
    // ==========================================

    /**
     * Check if php mode is Swoole (Octane)
     * Unified check: only 'swoole' mode exists (internally uses Octane+Swoole)
     *
     * @param string $phpMode PHP mode to check
     * @return bool True if Swoole mode
     */
    public static function isSwooleMode(string $phpMode): bool
    {
        return $phpMode === 'swoole';
    }

    /**
     * Get normalized PHP mode
     * Converts legacy 'octane' to 'swoole'
     *
     * @param string $phpMode PHP mode to normalize
     * @return string Normalized PHP mode
     */
    public static function normalizePhpMode(string $phpMode): string
    {
        return ($phpMode === 'octane') ? 'swoole' : $phpMode;
    }

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
     * Get Let's Encrypt certificates directory (environment-aware)
     * Uses map_web_path("nginxconfig")/letsencrypt instead of /etc/letsencrypt
     *
     * @return string The Let's Encrypt certificates base directory
     */
    public static function getLetsEncryptDir(): string
    {
        $nginxConfigDir = self::getNginxConfigDir();
        return $nginxConfigDir . '/letsencrypt';
    }

    /**
     * Get Let's Encrypt live certificates directory for a domain (environment-aware)
     *
     * @param string $domain The domain name
     * @return string The Let's Encrypt live certificates directory path
     */
    public static function getLetsEncryptLiveDir(string $domain): string
    {
        $cleanDomain = trim(preg_replace('/[\r\n\t]/', '', $domain));
        return self::getLetsEncryptDir() . '/live/' . $cleanDomain;
    }

    /**
     * Get Let's Encrypt certificate file path (fullchain.pem) for a domain (environment-aware)
     *
     * @param string $domain The domain name
     * @return string The certificate file path
     */
    public static function getLetsEncryptCertPath(string $domain): string
    {
        return self::getLetsEncryptLiveDir($domain) . '/fullchain.pem';
    }

    /**
     * Get Let's Encrypt private key file path (privkey.pem) for a domain (environment-aware)
     *
     * @param string $domain The domain name
     * @return string The private key file path
     */
    public static function getLetsEncryptKeyPath(string $domain): string
    {
        return self::getLetsEncryptLiveDir($domain) . '/privkey.pem';
    }

    /**
     * Get Let's Encrypt chain file path (chain.pem) for a domain (environment-aware)
     *
     * @param string $domain The domain name
     * @return string The chain file path
     */
    public static function getLetsEncryptChainPath(string $domain): string
    {
        return self::getLetsEncryptLiveDir($domain) . '/chain.pem';
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
            PathMapper::mapWebPath('nginxconfig') . '/conf.d',
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
