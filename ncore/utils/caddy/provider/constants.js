const path = require('path');
const fs = require('fs');
const { execCmdResultText } = require('#@/ncore/basic/libs/commander.js');

const CADDY_PATHS = {
    ROOT: '/usr/local/caddy',
    BIN: '/usr/local/bin/caddy',
    CONFIG: '/etc/caddy/Caddyfile',
    ENV: '/etc/default/caddy',
    SERVICE: '/etc/systemd/system/caddy.service',
    CONFIG_DIR: '/etc/caddy',
    DATA_DIR: '/var/lib/caddy',
    LOG_DIR: '/var/log/caddy',
    WWW_ROOT: '/var/www'
};

const CADDY_USER = {
    USER: 'caddy',
    GROUP: 'caddy'
};

const CADDY_PORTS = {
    HTTP: 80,
    HTTPS: 443,
    ADMIN: 2019
};

const CADDY_MODES = {
    DIR: 0o755,
    CONFIG: 0o644,
    SERVICE: 0o644
};

/**
 * System support information
 */
const SUPPORTED_SYSTEMS = {
    DEBIAN: 'debian',
    UBUNTU: 'ubuntu',
    CENTOS: 'centos'
};

function validatePaths() {
    const missingPaths = [];
    for (const [key, value] of Object.entries(CADDY_PATHS)) {
        if (!fs.existsSync(value)) {
            missingPaths.push({ key, path: value });
        }
    }
    return {
        valid: missingPaths.length === 0,
        missing: missingPaths
    };
}

/**
 * Generate a unique directory name for a domain
 * @param {string} domain Domain name
 * @returns {string} Unique directory name
 */
function generateUniqueDirName(domain) {
    const baseName = domain.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    let dirName = baseName;
    let counter = 1;

    while (fs.existsSync(path.join(CADDY_PATHS.WWW_ROOT, dirName))) {
        dirName = `${baseName}_${counter}`;
        counter++;
    }

    return dirName;
}

/**
 * Resolve www root path
 * @param {string} wwwRoot Optional relative path
 * @param {string} domain Domain name for auto-generation
 * @returns {string} Absolute path
 */
function resolveWwwRoot(wwwRoot, domain) {
    if (!wwwRoot) {
        wwwRoot = generateUniqueDirName(domain);
    }

    // If path is relative, make it relative to WWW_ROOT
    if (!path.isAbsolute(wwwRoot)) {
        return path.join(CADDY_PATHS.WWW_ROOT, wwwRoot);
    }

    return wwwRoot;
}

/**
 * Get current system information
 * @returns {Promise<Object>} System information
 */
async function getSystemInfo() {
    try {
        // Try to read /etc/os-release
        const osReleaseContent = await fs.promises.readFile('/etc/os-release', 'utf8');
        const osInfo = {};
        
        osReleaseContent.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                osInfo[key] = value.replace(/"/g, '');
            }
        });

        // Get system version
        let version = '';
        try {
            if (fs.existsSync('/etc/debian_version')) {
                version = await fs.promises.readFile('/etc/debian_version', 'utf8');
            }
        } catch (error) {
            // Ignore error
        }

        return {
            id: osInfo.ID || '',
            name: osInfo.NAME || '',
            version: version.trim() || osInfo.VERSION_ID || '',
            prettyName: osInfo.PRETTY_NAME || ''
        };
    } catch (error) {
        return null;
    }
}

/**
 * Check if current system is supported
 * @returns {Promise<Object>} Support status
 */
async function checkSystemSupport() {
    try {
        const systemInfo = await getSystemInfo();
        if (!systemInfo) {
            return {
                supported: false,
                reason: 'Unable to determine system information',
                system: null
            };
        }

        const id = systemInfo.id.toLowerCase();
        let supported = false;
        let detectedSystem = null;

        if (id.includes(SUPPORTED_SYSTEMS.DEBIAN)) {
            supported = true;
            detectedSystem = SUPPORTED_SYSTEMS.DEBIAN;
        } else if (id.includes(SUPPORTED_SYSTEMS.UBUNTU)) {
            supported = true;
            detectedSystem = SUPPORTED_SYSTEMS.UBUNTU;
        } else if (id.includes(SUPPORTED_SYSTEMS.CENTOS)) {
            supported = true;
            detectedSystem = SUPPORTED_SYSTEMS.CENTOS;
        }

        return {
            supported,
            system: detectedSystem,
            info: systemInfo,
            reason: supported ? 'System supported' : 'Unsupported operating system'
        };
    } catch (error) {
        return {
            supported: false,
            system: null,
            info: null,
            reason: `Error checking system support: ${error.message}`
        };
    }
}

// Export everything
module.exports = {
    CADDY_PATHS,
    CADDY_USER,
    CADDY_PORTS,
    CADDY_MODES,
    SUPPORTED_SYSTEMS,
    validatePaths,
    resolveWwwRoot,
    checkSystemSupport
}; 