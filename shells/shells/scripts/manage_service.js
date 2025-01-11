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

const SERVICE_DIR = '/etc/systemd/system';
const SERVICE_NAME = 'node-app.service';
const SERVICE_PATH = path.join(SERVICE_DIR, SERVICE_NAME);

/**
 * Check if running as root
 * @returns {boolean} Whether script is running as root
 */
function isRoot() {
    return process.getuid && process.getuid() === 0;
}

/**
 * Detect operating system
 * @returns {Object} OS information
 */
function detectOS() {
    try {
        const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
        const osInfo = {};
        osRelease.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                osInfo[key] = value.replace(/"/g, '');
            }
        });
        return {
            name: osInfo.ID || '',
            version: osInfo.VERSION_ID || '',
            prettyName: osInfo.PRETTY_NAME || ''
        };
    } catch (error) {
        throw new Error('Unsupported operating system');
    }
}

/**
 * Validate script path
 * @param {string} scriptPath - Path to the script
 * @returns {string} Absolute path to the script
 */
function validateScript(scriptPath) {
    const absolutePath = path.resolve(scriptPath);
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Script not found: ${absolutePath}`);
    }
    return absolutePath;
}

/**
 * Create systemd service file content
 * @param {string} scriptPath - Path to the script
 * @param {string[]} args - Command line arguments
 * @returns {string} Service file content
 */
function createServiceContent(scriptPath, args) {
    const nodePath = process.execPath;
    const workingDir = path.dirname(scriptPath);
    const arguments = args.map(arg => `"${arg}"`).join(' ');

    return `[Unit]
Description=Node.js Application Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${workingDir}
ExecStart=${nodePath} ${scriptPath} ${arguments}
Restart=always
RestartSec=10
StandardOutput=append:/var/log/node-app.log
StandardError=append:/var/log/node-app.error.log

[Install]
WantedBy=multi-user.target`;
}

/**
 * Install or update service
 * @param {string} scriptPath - Path to the script
 * @param {string[]} args - Command line arguments
 */
function installService(scriptPath, args) {
    const absolutePath = validateScript(scriptPath);
    const serviceContent = createServiceContent(absolutePath, args);

    log.info('Installing/Updating system service...');
    log.info(`Script path: ${absolutePath}`);
    log.info(`Arguments: ${args.join(' ')}`);

    try {
        fs.writeFileSync(SERVICE_PATH, serviceContent);
        execSync('systemctl daemon-reload');
        execSync(`systemctl enable ${SERVICE_NAME}`);
        log.success('Service installed successfully');
        log.info('Service status:');
        console.log(execSync(`systemctl status ${SERVICE_NAME}`).toString());
    } catch (error) {
        throw new Error(`Failed to install service: ${error.message}`);
    }
}

/**
 * Remove service
 */
function removeService() {
    log.info('Removing system service...');
    try {
        execSync(`systemctl stop ${SERVICE_NAME}`);
        execSync(`systemctl disable ${SERVICE_NAME}`);
        fs.unlinkSync(SERVICE_PATH);
        execSync('systemctl daemon-reload');
        log.success('Service removed successfully');
    } catch (error) {
        throw new Error(`Failed to remove service: ${error.message}`);
    }
}

/**
 * Show service status
 */
function showStatus() {
    try {
        if (fs.existsSync(SERVICE_PATH)) {
            log.info('Current service configuration:');
            console.log(fs.readFileSync(SERVICE_PATH, 'utf8'));
            log.info('\nService status:');
            console.log(execSync(`systemctl status ${SERVICE_NAME}`).toString());
        } else {
            log.warn('Service is not installed');
        }
    } catch (error) {
        log.error('Error getting service status:', error.message);
    }
}

/**
 * Print usage information
 */
function printUsage() {
    console.log(`
Usage: sudo node manage_service.js <command> [options]

Commands:
  install <script> [args...]  Install or update service with the specified script and arguments
  remove                      Remove the service
  status                      Show service status and configuration

Examples:
  sudo node manage_service.js install /path/to/app.js --port=3000
  sudo node manage_service.js remove
  sudo node manage_service.js status

Note: This script requires root privileges to manage system services.
`);
}

/**
 * Main function
 */
async function main() {
    try {
        // Check root privileges
        if (!isRoot()) {
            throw new Error('This script must be run as root (sudo)');
        }

        // Check OS compatibility
        const os = detectOS();
        log.info(`Detected OS: ${os.prettyName}`);
        
        if (!['ubuntu', 'debian', 'centos', 'rhel', 'fedora'].includes(os.name)) {
            throw new Error(`Unsupported operating system: ${os.prettyName}`);
        }

        const [command, ...args] = process.argv.slice(2);

        switch (command) {
            case 'install':
                if (args.length < 1) {
                    throw new Error('Script path is required');
                }
                const [scriptPath, ...scriptArgs] = args;
                installService(scriptPath, scriptArgs);
                break;

            case 'remove':
                removeService();
                break;

            case 'status':
                showStatus();
                break;

            default:
                printUsage();
                break;
        }
    } catch (error) {
        log.error('Error:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        log.error('Unexpected error:', error);
        process.exit(1);
    });
}

module.exports = {
    installService,
    removeService,
    showStatus,
    detectOS
}; 