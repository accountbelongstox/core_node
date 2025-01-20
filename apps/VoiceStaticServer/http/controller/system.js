const { execCmdResultText, pipeExecCmd } = require('#@/ncore/basic/libs/commander.js');
let log;
try {
    const logger = require('#@logger');
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
            log.error('Invalid top output format: separator line not found');
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
        log.error('Error parsing top output:', error);
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
        log.error('Failed to install htop:', error);
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
        log.error('Error getting system load:', error);
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
        log.error('Error getting system load:', error);
        return {
            success: false,
            message: `Failed to get system load: ${error.message}`,
            data: null
        };
    }
}

module.exports = {
    getSystemLoad,
    parseTopOutput,
    getSystemLoadRaw
};
