<?php

namespace App\Utils;

use App\Providers\PathMapper;
use Illuminate\Support\Facades\Process;

class SystemUtil
{
    /**
     * Detect if running in WSL/Desktop environment
     *
     * @return bool
     */
    public static function isWslDesktopEnvironment(): bool
    {
        return PathMapper::isWSL() || PathMapper::hasDesktopEnvironment();
    }

    /**
     * Detect user for running processes
     *
     * By default, returns 'root' for production server environments.
     * Only searches for non-root user when:
     * - Running in WSL/Desktop environment AND
     * - $requireNonRoot is explicitly set to true
     *
     * @param bool $requireNonRoot Force detection of non-root user (default: false)
     * @return string The detected username
     */
    public static function detectUser(bool $requireNonRoot = false): string
    {
        if (!$requireNonRoot) {
            return 'root';
        }

        if (!self::isWslDesktopEnvironment()) {
            return 'root';
        }

        return self::findNonRootUser();
    }

    /**
     * Legacy method for backward compatibility
     * Now defaults to root unless in WSL/Desktop
     *
     * @return string The detected username
     */
    public static function detectRealUser(): string
    {
        return self::detectUser(self::isWslDesktopEnvironment());
    }

    /**
     * Find a non-root user by scanning environment and /home directory
     *
     * Detection methods (in order of priority):
     * 1. SUDO_USER environment variable
     * 2. Owner of current working directory
     * 3. Scan /home directory for real users (excluding system/service users)
     * 4. Check logged-in users via 'who' command
     * 5. Fallback to 'root'
     *
     * @return string The detected username
     */
    public static function findNonRootUser(): string
    {
        $serviceUsers = [
            'root', 'git', 'www-data', 'nginx', 'apache', 'mysql', 'postgres',
            'redis', 'mongodb', 'docker', 'systemd-network', 'systemd-resolve',
            'gitlab-runner', 'jenkins', 'deploy', 'deployer', 'nobody', 'daemon'
        ];

        $isServiceUser = function($username) use ($serviceUsers) {
            return in_array($username, $serviceUsers);
        };

        $sudoUser = getenv('SUDO_USER');
        if ($sudoUser && !$isServiceUser($sudoUser)) {
            return $sudoUser;
        }

        $cwd = getcwd();
        if ($cwd && file_exists($cwd)) {
            $stat = stat($cwd);
            if ($stat && isset($stat['uid'])) {
                $userInfo = posix_getpwuid($stat['uid']);
                if ($userInfo && !$isServiceUser($userInfo['name'])) {
                    return $userInfo['name'];
                }
            }
        }

        if (is_dir('/home')) {
            $homeUsers = [];
            $homeDirs = scandir('/home');

            foreach ($homeDirs as $dir) {
                if ($dir === '.' || $dir === '..') {
                    continue;
                }

                $fullPath = "/home/$dir";
                if (is_dir($fullPath)) {
                    $userInfo = posix_getpwnam($dir);
                    if ($userInfo &&
                        !in_array($userInfo['shell'], ['/bin/false', '/usr/sbin/nologin']) &&
                        !$isServiceUser($dir)) {
                        $homeUsers[] = $dir;
                    }
                }
            }

            if (in_array('ubuntu', $homeUsers)) {
                return 'ubuntu';
            }

            if (!empty($homeUsers)) {
                return $homeUsers[0];
            }
        }

        $whoResult = Process::run('who | awk \'{print $1}\' | head -1');
        if ($whoResult->successful()) {
            $whoUser = trim($whoResult->output());
            if ($whoUser && !$isServiceUser($whoUser)) {
                return $whoUser;
            }
        }

        return 'root';
    }

    /**
     * Get list of service/system users that should be excluded
     *
     * @return array
     */
    public static function getServiceUsers(): array
    {
        return [
            'root', 'git', 'www-data', 'nginx', 'apache', 'mysql', 'postgres',
            'redis', 'mongodb', 'docker', 'systemd-network', 'systemd-resolve',
            'gitlab-runner', 'jenkins', 'deploy', 'deployer', 'nobody', 'daemon'
        ];
    }

    /**
     * Check if a username is a service/system user
     *
     * @param string $username
     * @return bool
     */
    public static function isServiceUser(string $username): bool
    {
        return in_array($username, self::getServiceUsers());
    }

    /**
     * Get all real users from /home directory (excluding service users)
     *
     * @return array
     */
    public static function getRealUsersFromHome(): array
    {
        $realUsers = [];

        if (!is_dir('/home')) {
            return $realUsers;
        }

        $homeDirs = scandir('/home');

        foreach ($homeDirs as $dir) {
            if ($dir === '.' || $dir === '..') {
                continue;
            }

            $fullPath = "/home/$dir";
            if (is_dir($fullPath)) {
                $userInfo = posix_getpwnam($dir);
                if ($userInfo &&
                    !in_array($userInfo['shell'], ['/bin/false', '/usr/sbin/nologin']) &&
                    !self::isServiceUser($dir)) {
                    $realUsers[] = $dir;
                }
            }
        }

        return $realUsers;
    }
}
