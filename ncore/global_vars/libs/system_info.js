// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

// systemInfo.js
const os = require('os');
const logger = require('#@logger');
const { execPowerShell } = require('#@ncore/global_config/libs/tool/common/cmder.js');
let si;
try {
    si = require('systeminformation');
    logger.info("Systeminformation module loaded successfully");
} catch (error) {
    logger.warn("Systeminformation module not available, using native methods");
}

function getOSInfo() {
    if (si) {
        try {
            return si.osInfo().then(data => ({
                platform: data.platform,
                release: data.release,
                arch: data.arch,
                version: data.distro + ' ' + data.codename
            }));
        } catch (error) {
            logger.error("Error fetching OS info via si:", error);
        }
    }
    return {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        version: os.version()
    };
}

function getMemoryUsage() {
    if (si) {
        try {
            return si.mem().then(data => ({
                total: data.total,
                free: data.free,
                used: data.used,
                active: data.active
            }));
        } catch (error) {
            logger.error("Error fetching memory info via si:", error);
        }
    }
    return {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem()
    };
}

function getCPUInfo() {
    if (si) {
        try {
            return si.cpu();
        } catch (error) {
            logger.error('Failed to get CPU information:', error);
            return null;
        }
    }
    return getCPUInfoNative();
}

function getDiskInfo() {
    if (si) {
        try {
            return si.diskLayout();
        } catch (error) {
            logger.error('Failed to get disk information:', error);
            return [];
        }
    }
    return getDiskInfoNative();
}

function getNetworkInfo() {
    if (si) {
        try {
            return si.networkInterfaces();
        } catch (error) {
            logger.error('Failed to get network information:', error);
            return [];
        }
    }
    return getNetworkInfoNative();
}

function getSystemUptime() {
    if (si) {
        try {
            return si.time();
        } catch (error) {
            return os.uptime();;
        }
    }
    return getSystemUptimeNative();
}

function getProcessInfo() {
    return {
        pid: process.pid,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
    };
}

let screenInfoCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache

async function getScreenInfo() {
    // Check cache validity
    if (screenInfoCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
        return screenInfoCache;
    }

    try {
        // Priority: Use systeminformation module
        if (si) {
            const graphicsData = await si.graphics();
            const displays = graphicsData.displays.map(display => ({
                resolutionX: display.currentResX,
                resolutionY: display.currentResY,
                vendor: display.vendor,
                model: display.model,
                serial: display.serial
            }));
            
            // Update cache
            screenInfoCache = displays;
            cacheTimestamp = Date.now();
            return displays;
        }
    } catch (siError) {
        logger.warn('Failed to get screen info via systeminformation:', siError);
    }

    // Fallback method when systeminformation is unavailable
    if (os.platform() === 'win32') {
        try {
            const output = await execPowerShell(
                `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::AllScreens | Select-Object @{Name='Width'; Expression={$_.Bounds.Width}}, @{Name='Height'; Expression={$_.Bounds.Height}} | ConvertTo-Json`,
                true
            );
            const displays = JSON.parse(output).map(display => ({
                resolutionX: display.Width,
                resolutionY: display.Height
            }));
            
            // Update cache
            screenInfoCache = displays;
            cacheTimestamp = Date.now();
            return displays;
        } catch (psError) {
            logger.error('Failed to retrieve screen info via PowerShell:', psError);
        }
    }

    // Return cached data if available when all methods fail
    return screenInfoCache || [];
}

module.exports = {
    getOSInfo,
    getMemoryUsage,
    getCPUInfo,
    getDiskInfo,
    getNetworkInfo,
    getSystemUptime,
    getProcessInfo,
    getScreenInfo
};

function getCPUInfoNative() {
    try {
        const cpus = os.cpus();
        return {
            model: cpus[0].model,
            cores: cpus.length,
            speed: cpus[0].speed
        };
    } catch (error) {
        logger.error('Failed to get CPU information:', error);
        return null;
    }
}

async function getDiskInfoNative() {
    if (os.platform() === 'win32') {
        try {
            const output = await execPowerShell(
                `Get-Volume | Select-Object DriveLetter,SizeRemaining,Size | ConvertTo-Json`,
                true
            );
            return JSON.parse(output).map(volume => ({
                device: volume.DriveLetter + ':',
                size: volume.Size || 0,
                free: volume.SizeRemaining || 0
            }));
        } catch (error) {
            logger.error('Failed to get disk info:', error);
            return [];
        }
    }
    return [];
}

function getNetworkInfoNative() {
    try {
        const interfaces = os.networkInterfaces();
        return Object.entries(interfaces).map(([name, details]) => ({
            interface: name,
            addresses: details.map(detail => ({
                address: detail.address,
                family: detail.family,
                internal: detail.internal
            }))
        }));
    } catch (error) {
        logger.error('Failed to get network information:', error);
        return [];
    }
}
