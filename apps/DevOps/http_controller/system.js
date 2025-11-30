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

const { execCmdResultText, pipeExecCmd } = require('#@commander');
const logger = require('#@logger');
/**
 * Parse top command output into header and process list
 * @param {string} topOutput - Raw output from top command
 * @returns {Object} Parsed top output with header and processes
 */
function parseTopOutput(topOutput) {
    const isNumberReg = /^\d+$/;
    const isFloatReg = /^\d+\.\d+$/;
    try {
        // Split output into lines
        const rawLines = topOutput.split('\n');
        const lines = rawLines.map(line => line.trim());
        const separatorIndex = lines.findIndex(line => {
            return line.trim() == ``;
        });

        if (separatorIndex === -1) {
            logger.error('Invalid top output format: separator line not found');
            return {};
        }

        const rawHeaderLines = lines.slice(0, separatorIndex);
        const rawProcessLines = lines.slice(separatorIndex + 1);
        const headerLines = rawHeaderLines.map(line => line.trim());
        const processLines = rawProcessLines.map(line => line.trim());

        const summaryInfo = {};
        headerLines.forEach(line => {
            let timeReg = /\d{2}:.+?(min|,)/;
            let time = line.match(timeReg);
            if (time) {
                const timeString = time[0];
                summaryInfo[`uptime`] = timeString;
                line = line.replace(timeString, ``);
            }
            const lastColonIndex = line.lastIndexOf(`:`)
            let key = line.substring(0, lastColonIndex);
            let value = line.substring(lastColonIndex + 1);

            const lastIndex = key.lastIndexOf(`,`)
            if (lastIndex !== -1) {
                key = key.substring(lastIndex + 1);
            }
            key = key.trim();
            const rawValues = value.split(`,`);
            const values = {};
            rawValues.forEach(value => {
                value = value.trim();
                let [vvalue, vkey] = value.split(/\s+/);
                if (vkey === 'undefined') vkey = 'default';
                if (isNumberReg.test(vvalue) || isFloatReg.test(vvalue)) {
                    values[vkey] = parseFloat(vvalue);
                } else {
                    values[vkey] = vvalue;
                }
            });
            if (key === 'undefined') key = 'default';
            summaryInfo[key] = values;
        });

        const processes = processLines
            .filter(line => line.trim())
            .map(line => line.trim());

        return summaryInfo;
    } catch (error) {
        logger.error('Error parsing top output:', error);
        return {};
    }
}

async function installHtop() {
    try {
        // Detect package manager and install htop
        if (await execCmdResultText('which apt')) {
            await pipeExecCmd('apt-get update && apt-get install -y htop');
        } else if (await execCmdResultText('which yum')) {
            await pipeExecCmd('yum install -y htop');
        } else {
            throw new Error('No supported package manager found (apt/yum)');
        }
        return true;
    } catch (error) {
        logger.error('Failed to install htop:', error);
        return false;
    }
}

async function getSystemLoadRaw() {
    try {
        // Check if running on Linux
        if (process.platform !== 'linux') {
            return {};
        }

        const topOutput = await execCmdResultText('top -b -n 1');
        const parsedTop = parseTopOutput(topOutput);

        return parsedTop

    } catch (error) {
        logger.error('Error getting system load:', error);
        return {};
    }
}

async function getSystemLoad() {
    try {
        const data = await getSystemLoadRaw();
        // Check if running on Linux
        if (process.platform !== 'linux') {
            return {
                success: false,
                message: 'This feature is only supported on Linux systems',
                data
            };
        }

        return {
            success: true,
            data
        };

    } catch (error) {
        logger.error('Error getting system load:', error);
        return {
            success: false,
            message: `Failed to get system load: ${error.message}`,
            data: null
        };
    }
}


async function getSystemMetrics() {
    try {
        if (process.platform !== 'linux') {
            return {
                success: false,
                message: 'This feature is only supported on Linux systems',
                data: null
            };
        }

        const uptimePromise = execCmdResultText('uptime');
        const cpuCoresPromise = execCmdResultText('nproc');
        const memInfoPromise = execCmdResultText('free -m');
        const diskInfoPromise = execCmdResultText('df -h /');
        const processInfoPromise = execCmdResultText('ps -eo pid,comm,%cpu,%mem --sort=-%cpu | head -n 11');

        const [
            uptimeOutput,
            cpuCoresOutput,
            memInfoOutput,
            diskInfoOutput,
            processInfoOutput
        ] = await Promise.all([
            uptimePromise,
            cpuCoresPromise,
            memInfoPromise,
            diskInfoPromise,
            processInfoPromise
        ]);

        // Parse Memory
        const memLines = memInfoOutput.split('\n');
        const memData = memLines[1].split(/\s+/);
        const memory = {
            total: parseInt(memData[1]),
            used: parseInt(memData[2]),
            free: parseInt(memData[3]),
            cached: parseInt(memData[5])
        };

        // Parse Disk
        const diskLines = diskInfoOutput.split('\n');
        const diskData = diskLines[1].split(/\s+/);
        const disk = {
            total: parseFloat(diskData[1]),
            used: parseFloat(diskData[2]),
            free: parseFloat(diskData[3])
        };

        // Parse Processes
        const processLines = processInfoOutput.split('\n').slice(1);
        const processes = processLines.map(line => {
            const parts = line.trim().split(/\s+/);
            return {
                pid: parseInt(parts[0]),
                name: parts[1],
                cpu: parseFloat(parts[2]),
                memory: parseFloat(parts[3])
            };
        });
        
        // Get CPU usage from top
        const topOutput = await execCmdResultText('top -b -n 1');
        const cpuUsage = topOutput.match(/%Cpu(s):\s+([0-9.]+\s+us)/)[1].split(' ')[0];


        const metrics = {
            timestamp: new Date().toISOString(),
            cpu: {
                usage: parseFloat(cpuUsage),
                cores: parseInt(cpuCoresOutput),
                processes: processes
            },
            memory: memory,
            disk: disk,
            network: { // Network data is not yet implemented
                inbound: 0,
                outbound: 0
            },
            uptime: uptimeOutput.trim()
        };

        return {
            success: true,
            data: metrics
        };

    } catch (error) {
        logger.error('Error getting system metrics:', error);
        return {
            success: false,
            message: `Failed to get system metrics: ${error.message}`,
            data: null
        };
    }
}

module.exports = {
    getSystemLoad,
    parseTopOutput,
    getSystemLoadRaw,
    getSystemMetrics
};

