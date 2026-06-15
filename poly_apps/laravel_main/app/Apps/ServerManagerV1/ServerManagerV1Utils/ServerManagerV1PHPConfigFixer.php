<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use App\Providers\PathMapper;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\File;

/**
 * ServerManagerV1 PHP Configuration Fixer
 * 
 * This class provides PHP configuration correction functionality that matches
 * the logic in 32_configure_php84.sh to ensure PHP-FPM open_basedir settings
 * are correctly configured based on the current path mapping.
 * 
 * IMPORTANT: This script must be called as a PRE-REQUISITE before any ServerManagerV1
 * operations that require PHP-FPM access to Laravel files.
 * 
 * RELATIONSHIP WITH 32_configure_php84.sh:
 * ==========================================
 * 
 * This PHP class is the equivalent of the shell script located at:
 *   Relative path from this file: ../../../../../../../../scripts/shells/linux/debian/install_shells/32_configure_php84.sh
 *   Absolute path: /www/programing/core_node/scripts/shells/linux/debian/install_shells/32_configure_php84.sh
 * 
 * PURPOSE AND INTENT:
 * ------------------
 * Both scripts serve the same purpose: ensuring PHP-FPM can access Laravel files
 * by configuring open_basedir settings correctly based on the environment.
 * 
 * The shell script (32_configure_php84.sh) is used during system installation
 * and can be run manually or via installation scripts. It uses gvar_common.sh
 * for path mapping.
 * 
 * This PHP class is used as a runtime fixer that can be called from Laravel
 * Artisan commands or API endpoints to ensure PHP configuration is correct
 * before performing operations. It uses PathMapper for path mapping.
 * 
 * PATH MAPPING CONSISTENCY:
 * -------------------------
 * Both scripts MUST use the same path mapping logic:
 * 
 * Shell script uses: gvar_common.sh -> map_web_path() -> get_base_data_directory()
 * PHP class uses:    PathMapper::mapWebPath() -> getBaseDataDirectory()
 * 
 * The path mapping logic MUST be kept in sync:
 * - WSL environment: /mnt/d/programing/core_node/poly_apps/laravel_main
 * - Production:      /www/programing/core_node/poly_apps/laravel_main
 * - Development:     (same as WSL or production based on environment detection)
 * 
 * KEY DIFFERENCES:
 * ------------------
 * 1. Shell script modifies /etc/php/8.4/cli/php.ini and /etc/php/8.4/fpm/php.ini
 *    PHP class modifies /etc/php/8.4/fpm/pool.d/www.conf (PHP-FPM pool config)
 * 
 * 2. Shell script uses sed commands via sudo
 *    PHP class uses PHP file operations (requires appropriate permissions)
 * 
 * 3. Shell script can be run during installation
 *    PHP class is run as a pre-requisite before ServerManagerV1 operations
 * 
 * SYNC REQUIREMENTS:
 * ------------------
 * If you modify the path mapping logic in one script, you MUST update the other:
 * 
 * - If gvar_common.sh map_web_path() changes -> Update PathMapper::mapWebPath()
 * - If PathMapper::mapWebPath() changes -> Update gvar_common.sh map_web_path()
 * - If 32_configure_php84.sh changes -> Update this class
 * - If this class changes -> Update 32_configure_php84.sh comments
 * 
 * MODIFICATION CHECKLIST:
 * -----------------------
 * When modifying this file, ensure you also check/update:
 * [ ] 32_configure_php84.sh (relative path: ../../../../../../../../scripts/shells/linux/debian/install_shells/32_configure_php84.sh)
 * [ ] gvar_common.sh (relative path: ../../../../../../../../scripts/shells/linux/common/gvar_common.sh)
 * [ ] PathMapper.php (relative path: ../../../../Providers/PathMapper.php)
 * [ ] php_common_functions.sh (relative path: ../../../../../../../../scripts/shells/linux/debian/debian_com/php_common_functions.sh)
 */
class ServerManagerV1PHPConfigFixer
{
    /**
     * PHP version to configure
     */
    private const PHP_VERSION = '8.4';
    
    /**
     * PHP-FPM pool configuration file
     */
    private const PHP_FPM_POOL_CONFIG = '/etc/php/8.4/fpm/pool.d/www.conf';
    
    /**
     * PHP INI files to configure
     */
    private const PHP_INI_FILES = [
        '/etc/php/8.4/cli/php.ini',
        '/etc/php/8.4/fpm/php.ini',
    ];
    
    /**
     * Fix PHP configuration to ensure Laravel files are accessible
     * 
     * This method performs the same configuration as 32_configure_php84.sh
     * but from PHP code. It ensures open_basedir restrictions are removed
     * or set correctly based on the current path mapping.
     * 
     * @return bool True if configuration was successful, false otherwise
     */
    public static function fixPHPConfiguration(): bool
    {
        try {
            Log::info('ServerManagerV1: Starting PHP configuration fix');
            
            // Step 1: Get Laravel directory path using PathMapper (must match gvar_common.sh logic)
            $laravelPath = self::getLaravelPath();
            Log::info('ServerManagerV1: Laravel path detected', ['path' => $laravelPath]);
            
            // Step 2: Fix PHP INI files (remove open_basedir restrictions)
            $iniFixed = self::fixPHPIniFiles();

            // Step 3: Fix PHP-FPM pool configuration (remove open_basedir restrictions)
            $poolFixed = self::fixPHPFpmPoolConfig();

            // Step 4: Fix project-level .user.ini file (HIGHEST PRIORITY)
            // .user.ini has higher priority than global PHP configuration
            $userIniFixed = self::fixProjectUserIni($laravelPath);

            if ($iniFixed && $poolFixed && $userIniFixed) {
                Log::info('ServerManagerV1: PHP configuration fixed successfully');
                return true;
            } else {
                Log::warning('ServerManagerV1: PHP configuration fix completed with warnings', [
                    'ini_fixed' => $iniFixed,
                    'pool_fixed' => $poolFixed,
                    'user_ini_fixed' => $userIniFixed
                ]);
                return false;
            }
        } catch (\Exception $e) {
            Log::error('ServerManagerV1: PHP configuration fix failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return false;
        }
    }
    
    /**
     * Get Laravel directory path using PathMapper
     * 
     * Uses PathMapper::getLaravelMainDir() which uses relative positioning
     * from PathMapper.php file location. This ensures no hardcoded paths.
     * 
     * @return string Laravel main directory path
     */
    private static function getLaravelPath(): string
    {
        // Use PathMapper::getLaravelMainDir() for relative positioning
        // This method calculates path relative to PathMapper.php location
        // No hardcoded paths - all paths are dynamically calculated
        return PathMapper::getLaravelMainDir();
    }
    
    /**
     * Fix PHP INI files by removing open_basedir restrictions
     * 
     * This matches the logic in php_common_functions.sh configure_php_for_laravel_from_php_common()
     * 
     * @return bool True if all files were fixed, false otherwise
     */
    private static function fixPHPIniFiles(): bool
    {
        $allFixed = true;
        
        foreach (self::PHP_INI_FILES as $iniFile) {
            if (!file_exists($iniFile)) {
                Log::warning('ServerManagerV1: PHP INI file not found', ['file' => $iniFile]);
                continue;
            }
            
            // Check if we can write to the file (requires root or appropriate permissions)
            if (!is_writable($iniFile)) {
                Log::warning('ServerManagerV1: PHP INI file not writable', ['file' => $iniFile]);
                $allFixed = false;
                continue;
            }
            
            // Read current content
            $content = file_get_contents($iniFile);
            if ($content === false) {
                Log::error('ServerManagerV1: Failed to read PHP INI file', ['file' => $iniFile]);
                $allFixed = false;
                continue;
            }
            
            // Remove existing open_basedir settings (matches sed commands in shell script)
            $content = preg_replace('/^open_basedir\s*=.*$/m', '', $content);
            $content = preg_replace('/^;open_basedir\s*=.*$/m', '', $content);
            
            // Add open_basedir = none (matches shell script: echo "open_basedir = none")
            // Only add if not already present
            if (strpos($content, 'open_basedir = none') === false) {
                $content .= "\nopen_basedir = none\n";
            }
            
            // Write back to file
            if (file_put_contents($iniFile, $content) === false) {
                Log::error('ServerManagerV1: Failed to write PHP INI file', ['file' => $iniFile]);
                $allFixed = false;
                continue;
            }
            
            Log::info('ServerManagerV1: Fixed PHP INI file', ['file' => $iniFile]);
        }
        
        return $allFixed;
    }
    
    /**
     * Fix PHP-FPM pool configuration by removing open_basedir restrictions
     * 
     * This is critical because PHP-FPM pool config can override php.ini settings
     * 
     * @return bool True if configuration was fixed, false otherwise
     */
    private static function fixPHPFpmPoolConfig(): bool
    {
        if (!file_exists(self::PHP_FPM_POOL_CONFIG)) {
            Log::warning('ServerManagerV1: PHP-FPM pool config not found', [
                'file' => self::PHP_FPM_POOL_CONFIG
            ]);
            return false;
        }
        
        // Check if we can write to the file
        if (!is_writable(self::PHP_FPM_POOL_CONFIG)) {
            Log::warning('ServerManagerV1: PHP-FPM pool config not writable', [
                'file' => self::PHP_FPM_POOL_CONFIG
            ]);
            return false;
        }
        
        // Read current content
        $content = file_get_contents(self::PHP_FPM_POOL_CONFIG);
        if ($content === false) {
            Log::error('ServerManagerV1: Failed to read PHP-FPM pool config');
            return false;
        }
        
        // Remove existing open_basedir settings from pool config
        // These can be set as:
        // php_value[open_basedir] = /path
        // php_admin_value[open_basedir] = /path
        $originalContent = $content;
        $content = preg_replace('/^php_value\[open_basedir\]\s*=.*$/m', '', $content);
        $content = preg_replace('/^php_admin_value\[open_basedir\]\s*=.*$/m', '', $content);
        $content = preg_replace('/^;php_value\[open_basedir\]\s*=.*$/m', '', $content);
        $content = preg_replace('/^;php_admin_value\[open_basedir\]\s*=.*$/m', '', $content);
        
        // Only write if content changed
        if ($content !== $originalContent) {
            if (file_put_contents(self::PHP_FPM_POOL_CONFIG, $content) === false) {
                Log::error('ServerManagerV1: Failed to write PHP-FPM pool config');
                return false;
            }
            
            Log::info('ServerManagerV1: Fixed PHP-FPM pool config', [
                'file' => self::PHP_FPM_POOL_CONFIG
            ]);
            
            // Note: We cannot restart PHP-FPM from PHP code, but we log that it's needed
            Log::info('ServerManagerV1: PHP-FPM restart required to apply changes', [
                'command' => 'sudo systemctl restart php8.4-fpm'
            ]);
        } else {
            Log::info('ServerManagerV1: PHP-FPM pool config already correct');
        }
        
        return true;
    }

    /**
     * Fix project-level .user.ini file
     *
     * .user.ini has HIGHER PRIORITY than global PHP configuration,
     * so it must be fixed to prevent open_basedir restrictions from taking effect.
     *
     * This is critical for Laravel poly projects that use PathMapper for
     * environment detection, as PathMapper needs to check multiple directories
     * (/mnt/c, /mnt/d, /data, /www) to determine the environment type.
     *
     * @param string $laravelPath Laravel main directory path
     * @return bool True if fixed successfully or no .user.ini exists
     */
    private static function fixProjectUserIni(string $laravelPath): bool
    {
        $userIniFile = $laravelPath . '/public/.user.ini';

        if (!file_exists($userIniFile)) {
            Log::info('ServerManagerV1: No .user.ini found (OK, will use global config)', [
                'file' => $userIniFile
            ]);
            return true;
        }

        // Check if writable
        if (!is_writable($userIniFile)) {
            Log::warning('ServerManagerV1: .user.ini not writable', [
                'file' => $userIniFile,
                'suggestion' => 'Run: sudo chmod 644 ' . $userIniFile
            ]);
            return false;
        }

        // Read content
        $content = file_get_contents($userIniFile);
        if ($content === false) {
            Log::error('ServerManagerV1: Failed to read .user.ini', [
                'file' => $userIniFile
            ]);
            return false;
        }

        // Store original for comparison
        $originalContent = $content;

        // Remove incorrect open_basedir settings
        $content = preg_replace('/^open_basedir\s*=.*$/m', '', $content);

        // Add open_basedir = none for Laravel poly projects
        // Only add if not already present
        if (strpos($content, 'open_basedir = none') === false) {
            // Add comment and setting at the beginning of file
            $header = "; Disable open_basedir for Laravel poly projects to allow PathMapper environment detection\n" .
                     "; PathMapper needs to check /mnt/c, /mnt/d, /data, /www directories\n" .
                     "open_basedir = none\n\n";
            $content = $header . $content;
        }

        // Only write if content changed
        if ($content !== $originalContent) {
            // Create backup before modifying
            $backupFile = $userIniFile . '.bak.' . date('Ymd_His');
            if (copy($userIniFile, $backupFile)) {
                Log::info('ServerManagerV1: Created .user.ini backup', [
                    'backup' => $backupFile
                ]);
            }

            if (file_put_contents($userIniFile, $content) === false) {
                Log::error('ServerManagerV1: Failed to write .user.ini', [
                    'file' => $userIniFile
                ]);
                return false;
            }

            Log::info('ServerManagerV1: Fixed project .user.ini', [
                'file' => $userIniFile,
                'changes' => 'Set open_basedir = none'
            ]);

            Log::info('ServerManagerV1: PHP-FPM restart required to apply .user.ini changes', [
                'command' => 'sudo systemctl restart php8.4-fpm',
                'note' => '.user.ini changes take effect on next request (may need cache clear)'
            ]);
        } else {
            Log::info('ServerManagerV1: Project .user.ini already correct', [
                'file' => $userIniFile
            ]);
        }

        return true;
    }

    /**
     * Verify PHP configuration is correct
     *
     * @return array Verification results
     */
    public static function verifyConfiguration(): array
    {
        $results = [
            'ini_files' => [],
            'pool_config' => [],
            'user_ini' => [],
            'overall' => true
        ];

        // Check INI files
        foreach (self::PHP_INI_FILES as $iniFile) {
            $hasRestriction = false;
            if (file_exists($iniFile)) {
                $content = file_get_contents($iniFile);
                // Check for open_basedir restrictions (not "none")
                if (preg_match('/^open_basedir\s*=\s*(?!none$).+$/m', $content)) {
                    $hasRestriction = true;
                }
            }
            $results['ini_files'][$iniFile] = !$hasRestriction;
            if ($hasRestriction) {
                $results['overall'] = false;
            }
        }

        // Check pool config
        if (file_exists(self::PHP_FPM_POOL_CONFIG)) {
            $content = file_get_contents(self::PHP_FPM_POOL_CONFIG);
            $hasRestriction = preg_match('/^php_(admin_)?value\[open_basedir\]\s*=/m', $content);
            $results['pool_config'][self::PHP_FPM_POOL_CONFIG] = !$hasRestriction;
            if ($hasRestriction) {
                $results['overall'] = false;
            }
        }

        // Check project .user.ini (HIGHEST PRIORITY - most important)
        $laravelPath = self::getLaravelPath();
        $userIniFile = $laravelPath . '/public/.user.ini';
        if (file_exists($userIniFile)) {
            $content = file_get_contents($userIniFile);
            // Check for open_basedir restrictions (not "none")
            $hasRestriction = preg_match('/^open_basedir\s*=\s*(?!none$).+$/m', $content);
            $results['user_ini'][$userIniFile] = !$hasRestriction;
            if ($hasRestriction) {
                $results['overall'] = false;
                // .user.ini has highest priority, so mark this specially
                $results['critical_issue'] = '.user.ini has open_basedir restriction (overrides all other settings)';
            }
        } else {
            $results['user_ini']['note'] = 'No .user.ini file (will use global config)';
        }

        return $results;
    }
}

