#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { IS_WINDOWS, safeExists, safeReadDir, safeStat, getWindowsUserInfo } = require('./fs_tools.js');

// System/service users to ignore
const IGNORED_USERS = new Set([
    'root',
    'nobody',
    'git',
    'www-data',
    'nginx',
    'apache',
    'mysql',
    'postgres',
    'redis',
    'docker',
    'daemon',
    'bin',
    'sys',
    'sync',
    'games',
    'man',
    'lp',
    'mail',
    'news',
    'uucp',
    'proxy',
    'www',
    'backup',
    'list',
    'irc',
    'gnats',
    '_apt',
    'systemd-network',
    'systemd-resolve',
    'messagebus',
    'sshd',
    'tcpdump',
    'tss',
    'landscape',
    'pollinate'
]);

/**
 * Check if a username should be ignored
 *
 * @param {string} username - Username to check
 * @returns {boolean} True if user should be ignored
 */
function shouldIgnoreUser(username) {
    return IGNORED_USERS.has(username);
}

/**
 * Get real (non-root) user by scanning system directories
 *
 * Windows: Uses USERNAME environment variable or os.userInfo()
 * Linux: Priority order:
 *   1. Scan /home directory for most recently modified user directory
 *   2. First non-system user (UID >= 1000) from passwd
 *
 * @returns {string} Real username
 * @throws {Error} If no valid user can be found
 */
function getRealUser() {
    // Windows detection
    if (IS_WINDOWS) {
        const userInfo = getWindowsUserInfo();
        if (userInfo && userInfo.username) {
            return userInfo.username;
        }
        throw new Error('Unable to determine Windows user');
    }

    // Linux detection - Priority 1: Scan /home directory for most recently modified user
    const homeDir = '/home';
    if (safeExists(homeDir)) {
        const homeDirs = safeReadDir(homeDir);
        let latestUser = null;
        let latestTime = 0;

        for (const dir of homeDirs) {
            // Skip ignored system/service users
            if (shouldIgnoreUser(dir)) {
                continue;
            }

            const userHome = path.join(homeDir, dir);
            const stat = safeStat(userHome);
            
            if (stat && stat.isDirectory() && stat.mtimeMs > latestTime) {
                // Verify this is a valid user
                try {
                    execSync(`id "${dir}"`, { stdio: 'ignore' });
                    latestTime = stat.mtimeMs;
                    latestUser = dir;
                } catch {
                    // Not a valid user, skip
                    continue;
                }
            }
        }

        if (latestUser) {
            return latestUser;
        }
    }

    // Linux detection - Priority 2: Get first non-system user from passwd (UID >= 1000)
    try {
        const passwd = execSync('getent passwd', { encoding: 'utf8' });
        const lines = passwd.split('\n');

        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 4) {
                const username = parts[0];
                const uid = parseInt(parts[2]);

                // Non-system user (UID >= 1000 and < 60000) and not in ignored list
                if (uid >= 1000 && uid < 60000 && !shouldIgnoreUser(username)) {
                    return username;
                }
            }
        }
    } catch (error) {
        console.warn(`[WARN] Failed to read passwd: ${error.message}`);
    }

    // No valid user found
    throw new Error('Unable to determine real user: No non-root user found in /home directory or passwd');
}

/**
 * Get real user home directory
 *
 * @returns {string} Home directory path
 */
function getRealUserHome() {
    // Windows: Use os.homedir()
    if (IS_WINDOWS) {
        try {
            const homedir = os.homedir();
            if (homedir) {
                return homedir;
            }
        } catch (error) {
            // Fall through
        }
        
        // Fallback: construct from username
        const username = getRealUser();
        return path.join('C:', 'Users', username);
    }

    // Linux: Try to get home from passwd
    const username = getRealUser();
    try {
        const result = execSync(`getent passwd "${username}"`, { encoding: 'utf8' });
        const parts = result.trim().split(':');
        if (parts.length >= 6) {
            return parts[5];
        }
    } catch (error) {
        console.warn(`[WARN] Failed to get home for ${username}: ${error.message}`);
    }

    // Fallback to /home/username
    return `/home/${username}`;
}

/**
 * Check if currently running as root/admin
 *
 * @returns {boolean} True if running as root (Linux) or admin (Windows)
 */
function isRoot() {
    if (IS_WINDOWS) {
        // On Windows, check if running as administrator
        // This is a simplified check - in practice, you'd need to check privileges
        // For now, return false as Windows doesn't have a direct equivalent
        return false;
    }
    
    return process.getuid && process.getuid() === 0;
}

// Export functions
module.exports = {
    getRealUser,
    getRealUserHome,
    isRoot
};

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0] || 'user';

    switch (command) {
        case 'user':
            console.log(getRealUser());
            break;
        case 'home':
            console.log(getRealUserHome());
            break;
        case 'isroot':
            console.log(isRoot());
            break;
        case 'all':
            console.log(JSON.stringify({
                user: getRealUser(),
                home: getRealUserHome(),
                isRoot: isRoot()
            }, null, 2));
            break;
        default:
            console.log(`
Real User Detection Tool
========================

Usage:
  node get_real_user.js [command]

Commands:
  user    - Get real username (default)
  home    - Get real user home directory
  isroot  - Check if running as root
  all     - Show all information as JSON

Examples:
  node get_real_user.js
  node get_real_user.js user
  node get_real_user.js home
  node get_real_user.js all
`);
    }
}
