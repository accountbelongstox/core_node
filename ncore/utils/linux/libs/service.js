const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

let log;
try {
    const logger = require('#@/ncore/utils/logger/index.js');
    log = {
        info: (...args) => logger.info(...args),
        warn: (...args) => logger.warn(...args),
        error: (...args) => logger.error(...args),
        success: (...args) => logger.success(...args)
    };
} catch (error) {
    log = {
        info: (...args) => console.log('[INFO]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        success: (...args) => console.log('[SUCCESS]', ...args)
    };
}

/**
 * Get system resource limits
 * @returns {Object} System resource information
 */
function getSystemResources() {
    const totalMemory = os.totalmem();
    const availableMemory = os.freemem();
    const cpuCount = os.cpus().length;

    return {
        totalMemory,
        availableMemory,
        cpuCount,
        defaultMemoryLimit: Math.floor(availableMemory / 4),
        defaultCpuShare: Math.max(Math.floor(cpuCount * 0.25 * 1024), 256) // 25% of CPU in shares
    };
}

/**
 * Generate service name from path
 * @param {string} execPath - Path to executable
 * @returns {string} Generated service name
 */
function generateServiceName(execPath) {
    // Extract filename without extension
    const baseName = path.basename(execPath, path.extname(execPath))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with dash
        .replace(/^-+|-+$/g, '');     // Remove leading/trailing dashes
    
    return `node-${baseName}`;
}

/**
 * Generate service description from path and args
 * @param {string} execPath - Path to executable
 * @param {string[]} args - Command arguments
 * @returns {string} Generated description
 */
function generateDescription(execPath, args) {
    const baseName = path.basename(execPath);
    const argsStr = args.length > 0 ? ` with args: ${args.join(' ')}` : '';
    return `Node.js service for ${baseName}${argsStr}`;
}

/**
 * Determine best working directory
 * @param {string} execPath - Path to executable
 * @returns {string} Working directory path
 */
function determineWorkingDir(execPath) {
    const dir = path.dirname(execPath);
    
    // Check for common project indicators
    const indicators = ['package.json', 'node_modules', '.git'];
    let currentDir = dir;
    
    while (currentDir !== '/' && currentDir !== '.') {
        if (indicators.some(indicator => fs.existsSync(path.join(currentDir, indicator)))) {
            return currentDir;
        }
        currentDir = path.dirname(currentDir);
    }
    
    // Fallback to script directory
    return dir;
}

/**
 * Create systemd service file content with resource limits
 * @param {Object} config - Service configuration
 * @param {string} [config.name] - Service name (optional)
 * @param {string} [config.description] - Service description (optional)
 * @param {string} config.execPath - Path to executable
 * @param {string[]} [config.args=[]] - Command arguments
 * @param {string} [config.workingDir] - Working directory (optional)
 * @param {Object} [config.resources] - Resource limits
 * @param {number} [config.resources.cpuShares] - CPU shares (1024 = 100%)
 * @param {number} [config.resources.memoryLimit] - Memory limit in bytes
 * @returns {string} Service file content
 */
function createServiceContent(config) {
    const resources = getSystemResources();
    let {
        name,
        description,
        execPath,
        args = [],
        workingDir,
        resources: {
            cpuShares = resources.defaultCpuShare,
            memoryLimit = resources.defaultMemoryLimit
        } = {}
    } = config;

    // Auto-generate missing fields
    if (!name) {
        name = generateServiceName(execPath);
        log.info(`Auto-generated service name: ${name}`);
    }

    if (!description) {
        description = generateDescription(execPath, args);
        log.info(`Auto-generated description: ${description}`);
    }

    if (!workingDir) {
        workingDir = determineWorkingDir(execPath);
        log.info(`Auto-detected working directory: ${workingDir}`);
    }

    const arguments = args.map(arg => `"${arg}"`).join(' ');
    const memoryLimitMB = Math.floor(memoryLimit / 1024 / 1024);

    // Create service content with environment setup
    return `[Unit]
Description=${description}
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${workingDir}
Environment=NODE_ENV=production
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=${execPath} ${arguments}
Restart=always
RestartSec=10

# Resource Limits
CPUShares=${cpuShares}
CPUQuota=${Math.floor((cpuShares / 1024) * 100)}%
MemoryLimit=${memoryLimitMB}M
MemoryAccounting=true

# Logging
StandardOutput=append:/var/log/${name}.log
StandardError=append:/var/log/${name}.error.log

# Security
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target`;
}

/**
 * Install or update a service
 * @param {Object} config - Service configuration
 * @returns {Promise<void>}
 */
async function installService(config) {
    const {
        name,
        execPath,
        serviceDir = '/etc/systemd/system'
    } = config;

    if (!name || !execPath) {
        throw new Error('Service name and execPath are required');
    }

    const servicePath = path.join(serviceDir, `${name}.service`);
    const serviceContent = createServiceContent(config);

    try {
        // Ensure executable exists
        if (!fs.existsSync(execPath)) {
            throw new Error(`Executable not found: ${execPath}`);
        }

        // Write service file
        fs.writeFileSync(servicePath, serviceContent);
        log.success(`Service file created: ${servicePath}`);

        // Reload systemd and enable service
        execSync('systemctl daemon-reload');
        execSync(`systemctl enable ${name}.service`);
        log.success('Service enabled successfully');

        // Show service status
        const status = execSync(`systemctl status ${name}.service`).toString();
        log.info('Service status:', status);

        // Show resource limits
        const resources = getSystemResources();
        log.info('Resource limits:');
        log.info(`- CPU: ${Math.floor((config.resources?.cpuShares || resources.defaultCpuShare) / 1024 * 100)}% (${config.resources?.cpuShares || resources.defaultCpuShare} shares)`);
        log.info(`- Memory: ${Math.floor((config.resources?.memoryLimit || resources.defaultMemoryLimit) / 1024 / 1024)}MB`);

    } catch (error) {
        throw new Error(`Failed to install service: ${error.message}`);
    }
}

/**
 * Remove a service
 * @param {string} name - Service name
 * @returns {Promise<void>}
 */
async function removeService(name) {
    try {
        execSync(`systemctl stop ${name}.service`);
        execSync(`systemctl disable ${name}.service`);
        const servicePath = path.join('/etc/systemd/system', `${name}.service`);
        fs.unlinkSync(servicePath);
        execSync('systemctl daemon-reload');
        log.success(`Service ${name} removed successfully`);
    } catch (error) {
        throw new Error(`Failed to remove service: ${error.message}`);
    }
}

/**
 * Get service status
 * @param {string} name - Service name
 * @returns {Promise<Object>} Service status
 */
async function getServiceStatus(name) {
    try {
        const servicePath = path.join('/etc/systemd/system', `${name}.service`);
        const exists = fs.existsSync(servicePath);
        
        if (!exists) {
            return { installed: false };
        }

        const config = fs.readFileSync(servicePath, 'utf8');
        const status = execSync(`systemctl status ${name}.service`).toString();
        const isActive = status.includes('Active: active');
        const pid = status.match(/Main PID: (\d+)/)?.[1];

        let resources = {};
        if (pid) {
            try {
                const cpuUsage = execSync(`ps -p ${pid} -o %cpu`).toString().split('\n')[1].trim();
                const memUsage = execSync(`ps -p ${pid} -o %mem`).toString().split('\n')[1].trim();
                resources = { cpuUsage, memUsage };
            } catch (e) {
                log.warn('Could not get resource usage:', e.message);
            }
        }

        return {
            installed: true,
            active: isActive,
            pid,
            config,
            status,
            resources
        };
    } catch (error) {
        throw new Error(`Failed to get service status: ${error.message}`);
    }
}

module.exports = {
    installService,
    removeService,
    getServiceStatus,
    getSystemResources,
    createServiceContent
}; 