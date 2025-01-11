const fs = require('fs');
const path = require('path');
const os = require('os');
const { getAppName } = require('#@/ncore/gvar/libs/appname.js');
const { pipeExecCmd,execCmdResultText } = require('#@utils_commander');
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

function getArgs() {
    const args = [];
    let isKeyReg = /^-+/;
    for (let i = 0; i < process.argv.length; i++) {
        const item = process.argv[i];
        if (item.includes('=')) {
            const [rawKey, ...valueParts] = item.split('=');
            const rawValue = valueParts.join('=');
            const key = rawKey.replace(/^-+/, '').toLowerCase();
            const value = rawValue.replace(/^["']|["']$/g, '');
            const itemObject = {}
            itemObject[key] = value;
            args.push(itemObject);
        }
        else if (item.includes(':')) {
            const [rawKey, ...valueParts] = item.split(':');
            const rawValue = valueParts.join(':');
            const key = rawKey.replace(/^-+/, '').toLowerCase();
            const value = rawValue.replace(/^["']|["']$/g, '');
            const itemObject = {}
            itemObject[key] = value;
            args.push(itemObject);
        }
        else {
            if (isKeyReg.test(item)) {
                const itemObject = {}
                const key = item.replace(/^-+/, '').toLowerCase();
                itemObject[key] = true;
                args.push(itemObject);
            } else {
                if (i == 0) {
                    const key = `exec`
                    const itemObject = {}
                    itemObject[key] = item;
                    args.push(itemObject);
                }
                else if (i == 1) {
                    const key = `entry`
                    const itemObject = {}
                    itemObject[key] = item;
                    args.push(itemObject);
                }
                else {

                    const keyAlias = item
                    const itemObjectAlias = {}
                    itemObjectAlias[keyAlias] = item;
                    args.push(itemObjectAlias);
                }
                const key = `${i}`
                const itemObject = {}
                itemObject[key] = item;
                args.push(itemObject);

            }
        }
    }
    return args;
}

function getArg(name, defaultValue = null) {
    const args = getArgs();
    const arg = args.find(arg => arg[name] !== undefined);
    if (arg) {
        return arg[name];
    }
    return defaultValue;
}

function removePersonalizedArgs(args) {
    delete args[`exec`]
    delete args[`entry`]
    delete args[`service`]
    return args
}

function getSystemResources() {
    const totalMemory = os.totalmem();
    const availableMemory = os.freemem();
    const cpuCount = os.cpus().length;

    return {
        totalMemory,
        availableMemory,
        cpuCount,
        defaultMemoryLimit: Math.floor(availableMemory / 2),
        defaultCpuShare: Math.max(Math.floor(cpuCount * 0.25 * 1024), 256) // 25% of CPU in shares
    };
}

function generateServiceName(config) {
    const execPath = config.execPath
    const appname = getServiceAppName(config)
    const baseName = path.basename(execPath, path.extname(execPath))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with dash
        .replace(/^-+|-+$/g, '');     // Remove leading/trailing dashes

    return `${appname}-${baseName}`;
}

function generateServiceDescription(config) {
    const { outputLog, outputErrorLog } = getServiceLogPath(config)
    const execPath = config.execPath
    const appname = getServiceAppName(config)
    const baseName = path.basename(execPath, path.extname(execPath))
    const arguments = argsObjectExpand(config.args,``)
    return `${appname}-${baseName}-service,args: ${arguments},outputLog: ${outputLog},outputErrorLog: ${outputErrorLog}`
}

function determineWorkingDir(config) {
    const execPath = config.entry ? config.entry : config.execPath
    const dir = path.dirname(execPath);

    const indicators = ['package.json', 'node_modules', '.git'];
    let currentDir = dir;

    while (currentDir !== '/' && currentDir !== '.') {
        if (indicators.some(indicator => fs.existsSync(path.join(currentDir, indicator)))) {
            return currentDir;
        }
        currentDir = path.dirname(currentDir);
    }
    return dir;
}

function argsObjectExpand(argsObject,symbol=`"`) {
    const args = {};
    let argsString = '';
    for (const key in argsObject) {
        args[key] = argsObject[key];
        argsString += `${key}=${symbol}${argsObject[key]}${symbol} `;
    }
    return argsString;
}

function getServiceLogPath(config) {
    const appname = getServiceAppName(config)
    const outputLog = path.join('/var/log', `${appname}.log`)
    const outputErrorLog = path.join('/var/log', `${appname}.error.log`)
    return { outputLog, outputErrorLog }
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
        entry = '',
        args = {},
        resources: {
            cpuShares = resources.defaultCpuShare,
            memoryLimit = resources.defaultMemoryLimit
        } = {}
    } = config;

    args = removePersonalizedArgs(args)

    if (!name) {
        name = generateServiceName(config);
        log.info(`Auto-generated service name: ${name}`);
    }

    const { outputLog, outputErrorLog } = getServiceLogPath(config)
    log.info(`outputLog: ${outputLog}`)
    log.info(`outputErrorLog: ${outputErrorLog}`)

    if (!description) {
        description = generateServiceDescription(config);
        log.info(`Auto-generated description: ${description}`);
    }

    
    const workingDir = determineWorkingDir(config);

    const arguments = argsObjectExpand(args)
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
ExecStart=${execPath} ${entry} ${arguments}
Restart=always
RestartSec=10

# Resource Limits
CPUShares=${cpuShares}
CPUQuota=${Math.floor((cpuShares / 1024) * 100)}%
MemoryLimit=${memoryLimitMB}M
MemoryAccounting=true

# Logging
StandardOutput=append:${outputLog}
StandardError=append:${outputErrorLog}
LogRateLimitIntervalSec=30
LogRateLimitBurst=1000
LogsDirectoryMode=0755
LogsMaxSize=100M
MaxRetentionSec=7day
MaxFileSec=1day

# Security
NoNewPrivileges=false
ProtectSystem=false
ProtectHome=false
PrivateTmp=false

[Install]
WantedBy=multi-user.target`;
}

function getServiceAppName(config) {
    const appname = config.appname ? config.appname : getAppName()
    return appname
}

async function installService(config) {
    const {
        execPath,
        entry = '',
        serviceDir = '/etc/systemd/system'
    } = config;
    let name = config.name
    if (!name) {
        name = generateServiceName(config)
    }
    if (!name || !execPath) {
        log.error('Service name and execPath are required');
    }

    const servicePath = path.join(serviceDir, `${name}.service`);
    const serviceContent = createServiceContent(config);

    try {
        // Ensure executable exists
        if (!fs.existsSync(execPath)) {
            log.error(`Executable not found: ${execPath}`);
        }

        // Write service file
        fs.writeFileSync(servicePath, serviceContent);
        log.success(`Service file created: ${servicePath}`);

        // Reload systemd and enable service
        pipeExecCmd('systemctl daemon-reload');
        pipeExecCmd(`systemctl enable ${name}.service`);
        log.success('Service enabled successfully');

        pipeExecCmd(`systemctl restart ${name}.service`);
        // Show service status
        let status = execCmdResultText(`systemctl status ${name}.service`);
        log.info(status)

        // Show resource limits
        const resources = getSystemResources();
        log.info('Resource limits:');
        log.info(`- CPU: ${Math.floor((config.resources?.cpuShares || resources.defaultCpuShare) / 1024 * 100)}% (${config.resources?.cpuShares || resources.defaultCpuShare} shares)`);
        log.info(`- Memory: ${Math.floor((config.resources?.memoryLimit || resources.defaultMemoryLimit) / 1024 / 1024)}MB`);

    } catch (error) {
        log.error(`Failed to install service: ${error.message} ${error.stack}`);
    }
}

/**
 * Remove a service
 * @param {string} name - Service name
 * @returns {Promise<void>}
 */
async function removeService(name) {
    try {
        pipeExecCmd(`systemctl stop ${name}.service`);
        pipeExecCmd(`systemctl disable ${name}.service`);
        const servicePath = path.join('/etc/systemd/system', `${name}.service`);
        fs.unlinkSync(servicePath);
        pipeExecCmd('systemctl daemon-reload');
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
        const status = execCmdResultText(`systemctl status ${name}.service`);
        const isActive = status.includes('Active: active');
        const pid = status.match(/Main PID: (\d+)/)?.[1];

        let resources = {};
        if (pid) {
            try {
                let result = execCmdResultText(`ps -p ${pid} -o %cpu`);
                const cpuUsage = result.split('\n')[1].trim()
                result = execCmdResultText(`ps -p ${pid} -o %mem`)
                const memUsage = result.split('\n')[1].trim()
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