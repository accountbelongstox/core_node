const os = require('os');
    const { execSync } = require('child_process');
    const fs = require('fs').promises;
    const path = require('path');
    const logger = require('../logger/logger.js');
    const config = require('../../config/index.js');

    const getCaddyDetails = async () => {
        try {
            // Get Caddy binary path
            const caddyPath = execSync('which caddy').toString().trim();
            
            // Get Caddy version with detailed info
            const versionDetails = execSync('caddy version --json').toString().trim();
            const versionInfo = JSON.parse(versionDetails);
            
            // Get Caddy status
            const adminApi = 'http://localhost:2019/config/';
            const configStatus = execSync(`curl -s ${adminApi}`).toString().trim();
            const configData = JSON.parse(configStatus);

            // Get active sites count (if possible)
            let activeSites = 0;
            try {
                const files = await fs.readdir(config.dataFolder);
                activeSites = files.filter(file => file.endsWith('.conf')).length;
            } catch (error) {
                logger.debug('Unable to count active sites', error);
            }

            // Get Caddy process info
            const processInfo = execSync('ps -p $(pgrep caddy) -o %cpu,%mem,etime').toString().trim();
            const [cpu, mem, uptime] = processInfo.split('\n')[1].trim().split(/\s+/);

            return {
                installed: true,
                binary: {
                    path: caddyPath,
                    size: (await fs.stat(caddyPath)).size,
                },
                version: versionInfo.version,
                build: {
                    date: versionInfo.buildDate,
                    features: versionInfo.features,
                    tags: versionInfo.tags
                },
                runtime: {
                    cpu: `${cpu}%`,
                    memory: `${mem}%`,
                    uptime: uptime
                },
                config: {
                    path: config.caddyFile,
                    activeSites: activeSites,
                    dataFolder: config.dataFolder,
                    logFolder: config.logFolder
                },
                status: {
                    running: true,
                    adminApi: 'http://localhost:2019',
                    activeConfig: configData
                }
            };
        } catch (error) {
            logger.debug('Error getting Caddy details', error);
            return {
                installed: false,
                error: error.message
            };
        }
    };

    exports.getSystemInfo = async () => {
        const info = {
            os: {
                type: os.type(),
                platform: os.platform(),
                release: os.release(),
                arch: os.arch(),
                uptime: os.uptime(),
                loadavg: os.loadavg(),
                networkInterfaces: os.networkInterfaces()
            },
            node: {
                version: process.version,
                env: process.env.NODE_ENV || 'development',
                pid: process.pid,
                platform: process.platform,
                arch: process.arch,
                versions: process.versions,
                memoryUsage: process.memoryUsage()
            },
            system: {
                hostname: os.hostname(),
                cpus: {
                    count: os.cpus().length,
                    model: os.cpus()[0].model,
                    speed: os.cpus()[0].speed
                },
                memory: {
                    total: os.totalmem(),
                    free: os.freemem(),
                    used: os.totalmem() - os.freemem()
                },
                platform: {
                    distro: await getLinuxDistro(),
                    release: await getLinuxRelease()
                }
            },
            caddy: {
                supported: os.platform() !== 'win32'
            }
        };

        // Add Caddy information if supported and installed
        if (info.caddy.supported) {
            info.caddy = {
                ...info.caddy,
                ...(await getCaddyDetails())
            };
        } else {
            info.caddy.message = 'Caddy is not supported on Windows platform';
        }

        return info;
    };

    // Helper function to get Linux distribution info
    async function getLinuxDistro() {
        try {
            if (os.platform() === 'linux') {
                const osRelease = await fs.readFile('/etc/os-release', 'utf8');
                const prettyName = osRelease.match(/PRETTY_NAME="(.+)"/);
                return prettyName ? prettyName[1] : 'Unknown Linux';
            }
            return os.type();
        } catch (error) {
            return 'Unknown';
        }
    }

    // Helper function to get Linux release info
    async function getLinuxRelease() {
        try {
            if (os.platform() === 'linux') {
                return await fs.readFile('/proc/version', 'utf8');
            }
            return os.release();
        } catch (error) {
            return os.release();
        }
    }