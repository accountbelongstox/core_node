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

const util = require('util');
const readline = require('readline');

/**
 * Detect if running in MCP mode
 * MCP mode uses stdio for JSON-RPC communication, so logs must go to stderr
 */
function isMCPMode() {
    const envMode = process.env.MCP_MODE || process.env.NODE_ENV;
    if (envMode === 'mcp') return true;

    const args = process.argv;
    for (const arg of args) {
        if (arg.toLowerCase().includes('mcp=true') ||
            arg.toLowerCase().includes('--mcp') ||
            arg.toLowerCase() === 'mcp') {
            return true;
        }
    }
    return false;
}

/**
 * Get output stream based on mode
 * In MCP mode, use stderr to avoid interfering with stdio communication
 */
function getOutputStream() {
    return isMCPMode() ? process.stderr : process.stdout;
}

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    white: '\x1b[37m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    command: '\x1b[35m',
    log: '\x1b[32m',
    debug: '\x1b[33m',
    gray: '\x1b[90m'
};

// Color wrapper functions
const colorize = {
    green: (text) => `${colors.green}${text}${colors.reset}`,
    white: (text) => `${colors.white}${text}${colors.reset}`,
    red: (text) => `${colors.red}${text}${colors.reset}`,
    yellow: (text) => `${colors.yellow}${text}${colors.reset}`,
    command: (text) => `${colors.command}${text}${colors.reset}`,
    log: (text) => `${colors.log}${text}${colors.reset}`,
    debug: (text) => `${colors.debug}${text}${colors.reset}`,
    gray: (text) => `${colors.gray}${text}${colors.reset}`
};

// Namespace stats storage
const namespaceStats = {};
function isDebugEnabled() {
    const args = process.argv.slice(2); // Exclude node and script path
    for (const arg of args) {
        const [key, value] = arg.split('=').map(str => str.trim().toLowerCase());

        if (key === 'debug') {
            if (value != "false" || value != "0") {
                return true
            }
            return false;
        }

        if (key === 'debug=true') return true; // Handles cases like --DEBUG=true
        if (key == 'debug=false') return false;
    }

    return false; // Default is false if not found
}
// Interval namespace for managing interval-related functionality
const interval = {
    INACTIVE_THRESHOLD: 60000, // 1 minute

    updateStats(funcNamespace, namespace, message) {
        if (!namespaceStats[funcNamespace]) {
            namespaceStats[funcNamespace] = {};
        }
        if (!namespaceStats[funcNamespace][namespace]) {
            namespaceStats[funcNamespace][namespace] = {
                lastLogTime: 0,
                lastAccessTime: Date.now(),
                skipCount: 0,
                buffer: new Set()
            };
        }
        const stats = namespaceStats[funcNamespace][namespace];
        stats.lastAccessTime = Date.now();
        if (message) stats.buffer.add(message);
        return stats;
    },

    cleanup(logger) {
        const now = Date.now();
        Object.entries(namespaceStats).forEach(([funcNamespace, namespaces]) => {
            Object.entries(namespaces).forEach(([namespace, stats]) => {
                if (namespace !== '_default' && now - stats.lastAccessTime > this.INACTIVE_THRESHOLD) {
                    if (stats.skipCount > 0) {
                        logger.debug(`Cleaning up inactive namespace: ${funcNamespace}:${namespace} (${stats.skipCount} skipped messages)`);
                    }
                    delete namespaceStats[funcNamespace][namespace];
                }
                if (Object.keys(namespaceStats[funcNamespace]).length === 0) {
                    delete namespaceStats[funcNamespace];
                }
            });
        });
    }
};
function getTrimmedMessage(message) {
    const outputStream = getOutputStream();
    const terminalWidth = outputStream.columns || 80;
    if (message.length > terminalWidth) {
        const maxLength = terminalWidth - 3;
        return message.substring(0, maxLength) + '...';
    }
    return message;
}
// Print buffer controller for managing interval-based printing
const printBufferController = (funcNamespace, namespace, intervalSeconds, message, printBuffer = false) => {
    const stats = interval.updateStats(funcNamespace, namespace, printBuffer ? message : null);
    const now = Date.now();
    const intervalMs = intervalSeconds * 1000;

    if (stats.lastLogTime == 0) {
        stats.lastLogTime = now;
        if (printBuffer) {
            const buffer = [...stats.buffer];
            stats.buffer.clear();
            return { shouldLog: true, skipped: 0, buffer };
        }
        return { shouldLog: true, skipped: 0, buffer: [] };
    }

    if (now - stats.lastLogTime >= intervalMs) {
        stats.lastLogTime = now;
        const hadSkipped = stats.skipCount > 0;
        const skippedCount = stats.skipCount;
        stats.skipCount = 0;

        if (printBuffer) {
            const buffer = [...stats.buffer];
            stats.buffer.clear();
            return { shouldLog: true, skipped: hadSkipped ? skippedCount : 0, buffer };
        }
        stats.buffer.clear();
        return { shouldLog: true, skipped: hadSkipped ? skippedCount : 0, buffer: [] };
    }

    stats.skipCount++;
    if (!printBuffer) {
        stats.buffer.clear();
    }
    return { shouldLog: false, skipped: 0, buffer: [] };
};

// Storage for limited logging counts
const limitedLogStorage = new Map();
const limitedDebugStorage = new Map(); // Add storage for debug messages

/**
 * Get the current count for a namespace
 * @private
 */
function getLimitedLogCount(namespace) {
    return limitedLogStorage.get(namespace) || 0;
}

/**
 * Check if debug message has been shown for namespace
 * @private
 */
function hasShownDebug(namespace) {
    return limitedDebugStorage.get(namespace) || false;
}

/**
 * Increment the count for a namespace
 * @private
 */
function incrementLimitedLogCount(namespace) {
    const currentCount = getLimitedLogCount(namespace);
    limitedLogStorage.set(namespace, currentCount + 1);
    return currentCount + 1;
}

class Logger {
    constructor() {
        this.debugMode = process.env.DEBUG || true;
        this.logLevel = process.env.LOG_LEVEL || 'debug';
        this.logLevels = {
            error: 0,
            warn: 1,
            info: 2,
            log: 3,
            success: 5,
            debug: 6,
            refresh: 9,
            multiProgress: 10,
            gray: 11,
        };
        this.lastLineCount = 0;
        this.progressBarWidth = 40;
        this.wsBroadcast = null;
        this.LOG_EVENT = 'server_log';

        // Configure log methods and their colors
        this.logConfigs = {
            gray: { color: 'gray', prefix: 'GRAY', level: 'info' },
            success: { color: 'green', prefix: 'SUCCESS', level: 'info' },
            log: { color: 'log', prefix: 'LOG', level: 'log' },
            command: { color: 'command', prefix: 'COMMAND', level: 'info' },
            error: { color: 'red', prefix: 'ERROR', level: 'error' },
            warn: { color: 'yellow', prefix: 'WARNING', level: 'warn' },
            info: { color: 'white', prefix: 'INFO', level: 'info' },
            debug: { color: 'debug', prefix: 'DEBUG', level: 'debug' }
        };

        this.isDebug = isDebugEnabled()
        // Start namespace cleanup interval
        setInterval(() => interval.cleanup(this), interval.INACTIVE_THRESHOLD);
    }

    /**
     * Set WebSocket instance for logger
     * @param {Object} broadcast - WebSocket broadcast function
     */
    setWsBroadcast(broadcast) {
        this.wsBroadcast = broadcast;
    }

    /**
     * Send log message to WebSocket clients
     * @param {string} level - Log level (info/warn/error/success)
     * @param {string} message - Log message
     * @param {Object} [data] - Additional data
     */
    sendLogToWs(level, message, data = null) {
        if (!this.wsBroadcast) return;

        this.wsBroadcast({
            event: this.LOG_EVENT,
            data: {
                timestamp: Date.now(),
                level,
                message,
                data,
                formatted: this.formatLogMessage(level, message)
            }
        });
    }

    handleIntervalLog = (funcNamespace, message, intervalSeconds, namespace = '_default', logLevel = 'info', printBuffer = false) => {
        const result = printBufferController(funcNamespace, namespace, intervalSeconds, message, printBuffer);
        if (result.shouldLog) {
            let finalMessage = message;
            if (printBuffer && result.buffer.length > 0) {
                finalMessage = `${message}\n${result.buffer.join('\n')}`;
            } else if (result.skipped > 0) {
                finalMessage = `${message} (Skipped ${result.skipped} messages)`;
            }
            this._log(logLevel, finalMessage);
        }
    };

    formatLogMessage(level, message) {
        return `[${new Date().toISOString()}] ${level.toUpperCase()}: ${message}`;
    }

    formatMessage(message, ...args) {
        return args.length > 0 ? util.format(message, ...args) : message;
    }

    shouldLog(level) {
        return this.logLevels[level] <= this.logLevels[this.logLevel];
    }

    // Generic logging method
    _log(type, message, ...args) {
        const config = this.logConfigs[type];
        if (!config) return;

        const shouldLog = type === 'debug' ?
            (this.debugMode && this.shouldLog(config.level)) :
            this.shouldLog(config.level);

        if (shouldLog) {
            const formattedMessage = this.formatMessage(message, ...args);
            const logMessage = `[${new Date().toISOString()}] ${config.prefix}: ${formattedMessage}`;
            const outputStream = getOutputStream();
            outputStream.write(colorize[config.color](logMessage) + '\n');
            this.sendLogToWs(type, formattedMessage);
        }
    }

    // Public logging methods
    success(message, ...args) { this._log('success', message, ...args); }
    log(message, ...args) { this._log('log', message, ...args); }
    command(message, ...args) { this._log('command', message, ...args); }
    error(message, ...args) { this._log('error', message, ...args); }
    warn(message, ...args) { this._log('warn', message, ...args); }
    gray(message, ...args) { this._log('gray', message, ...args); }
    info(message, ...args) { this._log('info', message, ...args); }
    debug(message, ...args) {
        const isDebug = isDebugEnabled()
        if (isDebug) {
            this._log('debug', message, ...args);
        }
    }
    success_skip(message, ...args) {
        this.handleIntervalLog('success', this.formatMessage(message, ...args), 0.5);
    }
    log_skip(message, ...args) {
        this.handleIntervalLog('log', this.formatMessage(message, ...args), 1);
    }
    warn_skip(message, ...args) {
        this.handleIntervalLog('debug', this.formatMessage(message, ...args), 0.5, '_default', 'debug', false);
    }
    info_skip(message, ...args) {
        this.handleIntervalLog('info', this.formatMessage(message, ...args), 0.5);
    }
    debug_skip(message, ...args) {
        this.handleIntervalLog('debug', this.formatMessage(message, ...args), 0.5, '_default', 'debug', true);
    }
    clearRefresh() {
        if (this.lastLineCount > 0) {
            const outputStream = getOutputStream();
            readline.moveCursor(outputStream, 0, -this.lastLineCount);
            readline.clearScreenDown(outputStream);
            this.lastLineCount = 0;
        }
    }

    progress(message, current = 1, total = 100, showType = 'info', options = {}) {
        const opts = {
            trimMessage: options.trimMessage || true,
            width: options.width || this.progressBarWidth,
            complete: options.complete || '█',
            incomplete: options.incomplete || '░',
            format: options.format || '[{bar}] {percentage}% | {current}/{total}'
        };

        let percentage = Math.min(100, Math.round((current / total) * 100));
        if (percentage > 100) percentage = 100
        const completeLength = Math.round((percentage / 100) * opts.width);
        const incompleteLength = opts.width - completeLength;

        const bar = opts.complete.repeat(completeLength) +
            opts.incomplete.repeat(incompleteLength);

        const baroutput = opts.format
            .replace('{bar}', bar)
            .replace('{percentage}', percentage.toString())
            .replace('{current}', current.toString())
            .replace('{total}', total.toString());
        const output = `${message}\n${baroutput}`
        this.refresh(output, showType, options.trimMessage);
    }


    /**
     * Draw a progress bar
     * @param {number} current - Current value
     * @param {number} total - Total value
     * @param {Object} options - Progress bar options
     */
    progressBar(current, total, options = {}) {
        if (!this.shouldLog('info')) return;

        const opts = {
            width: options.width || this.progressBarWidth,
            complete: options.complete || '█',
            incomplete: options.incomplete || '░',
            format: options.format || 'Progress: [{bar}] {percentage}% | {current}/{total}'
        };

        const percentage = Math.min(100, Math.round((current / total) * 100));
        const completeLength = Math.round((percentage / 100) * opts.width);
        const incompleteLength = opts.width - completeLength;

        const bar = opts.complete.repeat(completeLength) +
            opts.incomplete.repeat(incompleteLength);

        const output = opts.format
            .replace('{bar}', bar)
            .replace('{percentage}', percentage.toString())
            .replace('{current}', current.toString())
            .replace('{total}', total.toString());

        this.refresh(output);
    }

    /**
     * Create a multi-line progress display
     * @param {Object[]} items - Array of progress items
     * @param {Object} options - Display options
     */
    multiProgress(items, options = {}) {
        if (!this.shouldLog('info')) return;

        const lines = items.map(item => {
            const percentage = Math.min(100, Math.round((item.current / item.total) * 100));
            const width = options.width || 30;
            const completeLength = Math.round((percentage / 100) * width);
            const bar = '█'.repeat(completeLength) + '░'.repeat(width - completeLength);

            return `${item.label}: [${bar}] ${percentage}% (${item.current}/${item.total})`;
        });

        this.refresh(lines);
    }

    /**
     * Log message with interval control. Messages are only printed if intervalSeconds has passed since last print.
     * @param {string} message - Current message to log
     * @param {number} intervalSeconds - Minimum interval between actual prints
     * @param {string} namespace - Namespace for the log
     * @param {string} logLevel - Log level to use
     * @param {boolean} printBuffer - If true, store skipped messages in buffer and print them together on next print
     */
    interval(message, intervalSeconds, namespace = '_default', logLevel = 'info', printBuffer = false) {
        this.handleIntervalLog('interval', message, intervalSeconds, namespace, logLevel, printBuffer);
    }

    /**
     * Refresh message(s) on screen
     * @param {string|string[]} message - Message to display (string or array of strings)
     * @param {string} logLevel - Log level (info, warn, error, success)
     */
    refresh(message, logLevel = 'info', trimMessage = true) {
        if (!this.shouldLog(logLevel)) return;
        const outputStream = getOutputStream();

        // Get color function based on log level
        const colorFunc = {
            'info': colorize.white,
            'warn': colorize.yellow,
            'error': colorize.red,
            'success': colorize.green
        }[logLevel] || colorize.white;

        // Convert message to array of lines
        const lines = Array.isArray(message) ?
            message :
            message.toString().split('\n');

        // Clear previous lines if any
        if (this.lastLineCount > 0) {
            readline.moveCursor(outputStream, 0, -this.lastLineCount);
            readline.clearScreenDown(outputStream);
        }

        lines.forEach(line => {
            const createMessage = `[${new Date().toISOString()}] ${line}\n`;
            const trimmedMessage = trimMessage ? getTrimmedMessage(createMessage) : createMessage;
            outputStream.write(colorFunc(trimmedMessage));
        });

        // Update line count
        this.lastLineCount = lines.length;
    }

    /**
     * Log a message limited number of times within a namespace
     * @param {string} message - Message to log
     * @param {number} [maxCount=1] - Maximum number of times to print
     * @param {string} [namespace='default'] - Namespace for the message
     * @param {string} [type='info'] - Log type ('info', 'warn', 'error', etc.)
     */
    limitedLog(message, maxCount = 1, namespace = 'default', type = 'info') {
        const count = incrementLimitedLogCount(namespace);
        if (count <= maxCount) {
            this._log(type, message);
        }
        if (count === maxCount && !hasShownDebug(namespace)) {
            this.debug(`Namespace "${namespace}" has reached its print limit of ${maxCount}`);
            limitedDebugStorage.set(namespace, true);
        }
    }

    /**
     * Reset the print count for a namespace
     * @param {string} namespace - Namespace to reset
     */
    resetLimitedLog(namespace = 'default') {
        limitedLogStorage.delete(namespace);
        limitedDebugStorage.delete(namespace);
    }

    /**
     * Reset all limited log counts
     */
    resetAllLimitedLogs() {
        limitedLogStorage.clear();
        limitedDebugStorage.clear();
    }
}

// Export only the logger instance
module.exports = new Logger();
