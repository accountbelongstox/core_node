const util = require('util');
const readline = require('readline');
function formatDurationToStr(timestamp) {
    const seconds = Math.floor(timestamp / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    const remainingMonths = Math.floor((days % 365) / 30);
    const remainingDays = days % 30;
    const remainingHours = hours % 24;
    const remainingMinutes = minutes % 60;
    const remainingSeconds = seconds % 60;
    if (years > 0) {
        return `${years}y ${remainingMonths}m ${remainingDays}d ${remainingHours}h ${remainingMinutes}m`;
    }
    if (months > 0) {
        return `${months}m ${remainingDays}d ${remainingHours}h ${remainingMinutes}m`;
    }
    if (days > 0) {
        return `${days}d ${remainingHours}h ${remainingMinutes}m ${remainingSeconds}s`;
    }
    if (hours > 0) {
        return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
    }
    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
}

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    white: '\x1b[37m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    gray: '\x1b[90m',
    cyan: '\x1b[36m',
    command: '\x1b[35m',
    log: '\x1b[32m',
    debug: '\x1b[33m',
    group: '\x1b[32m',
    custom: '\x1b[32m',
    refresh: '\x1b[32m',
    multiProgress: '\x1b[32m',
    logObject: '\x1b[32m',
    logExecutionTime: '\x1b[32m',
    createScopedLogger: '\x1b[32m',
    setLogLevel: '\x1b[32m',
    setDebugMode: '\x1b[32m'
};

// Color wrapper functions
const colorize = {
    green: (text) => `${colors.green}${text}${colors.reset}`,
    white: (text) => `${colors.white}${text}${colors.reset}`,
    red: (text) => `${colors.red}${text}${colors.reset}`,
    yellow: (text) => `${colors.yellow}${text}${colors.reset}`,
    blue: (text) => `${colors.blue}${text}${colors.reset}`,
    log: (text) => `${colors.log}${text}${colors.reset}`,
    gray: (text) => `${colors.gray}${text}${colors.reset}`,
    cyan: (text) => `${colors.cyan}${text}${colors.reset}`,
    command: (text) => `${colors.command}${text}${colors.reset}`,
    debug: (text) => `${colors.debug}${text}${colors.reset}`,
    group: (text) => `${colors.group}${text}${colors.reset}`,
    custom: (text) => `${colors.custom}${text}${colors.reset}`,
    refresh: (text) => `${colors.refresh}${text}${colors.reset}`,
    multiProgress: (text) => `${colors.multiProgress}${text}${colors.reset}`,
    logObject: (text) => `${colors.logObject}${text}${colors.reset}`,
    logExecutionTime: (text) => `${colors.logExecutionTime}${text}${colors.reset}`,
    createScopedLogger: (text) => `${colors.createScopedLogger}${text}${colors.reset}`,
    setLogLevel: (text) => `${colors.setLogLevel}${text}${colors.reset}`,
    setDebugMode: (text) => `${colors.setDebugMode}${text}${colors.reset}`
};

class Logger {
    constructor() {
        this.debugMode = process.env.DEBUG || true;
        this.logLevel = process.env.LOG_LEVEL || 'debug';
        this.logLevels = {
            error: 0,
            warn: 1,
            info: 2,
            log: 3,
            command: 4,
            success: 5,
            debug: 6,
            group: 7,
            custom: 8,
            refresh: 9,
            multiProgress: 10,
            logObject: 11,
            logExecutionTime: 12,
            createScopedLogger: 13,
            setLogLevel: 14,
            setDebugMode: 15
        };
        this.lastLineCount = 0;
        this.progressBarWidth = 40;
        this.wsBroadcast = null;
        this.LOG_EVENT = 'server_log';

        // Initialize namespace logging stats
        this.namespaceStats = {
            _default: {
                lastLogTime: 0,
                lastAccessTime: Date.now(),
                skipCount: 0
            }
        };

        // Start namespace cleanup interval
        setInterval(() => this.cleanupNamespaces(), 60000); // Check every minute
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

    formatLogMessage(level, message) {
        const timestamp = formatDurationToStr(new Date());
        return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    }

    /**
     * Clean up inactive namespaces (no access for more than 1 minute)
     * @private
     */
    cleanupNamespaces() {
        const now = Date.now();
        const INACTIVE_THRESHOLD = 60000; // 1 minute

        Object.entries(this.namespaceStats).forEach(([namespace, stats]) => {
            if (namespace !== '_default' && now - stats.lastAccessTime > INACTIVE_THRESHOLD) {
                this.debug(`Cleaning up inactive namespace: ${namespace} (${stats.skipCount} skipped messages)`);
                delete this.namespaceStats[namespace];
            }
        });
    }

    formatMessage(message, ...args) {
        if (args.length > 0) {
            return util.format(message, ...args);
        }
        return message;
    }

    getTimestamp() {
        return new Date().toISOString();
    }

    shouldLog(level) {
        return this.logLevels[level] <= this.logLevels[this.logLevel];
    }

    success(message, ...args) {
        if (this.shouldLog('info')) {
            const formattedMessage = this.formatMessage(message, ...args);
            console.log(colorize.green(`[${this.getTimestamp()}] SUCCESS: ${formattedMessage}`));
            this.sendLogToWs('success', formattedMessage);
        }
    }

    log(message, ...args) {
        if (this.shouldLog('log')) {
            const formattedMessage = this.formatMessage(message, ...args);
            console.log(colorize.log(`[${this.getTimestamp()}] LOG: ${formattedMessage}`));
            this.sendLogToWs('info', formattedMessage);
        }
    }

    command(message, ...args) {
        if (this.shouldLog('info')) {
            const formattedMessage = this.formatMessage(message, ...args);
            console.log(colorize.command(`[${this.getTimestamp()}] COMMAND: ${formattedMessage}`));
            this.sendLogToWs('info', formattedMessage);
        }
    }

    error(message, ...args) {
        if (this.shouldLog('error')) {
            const formattedMessage = this.formatMessage(message, ...args);
            console.error(colorize.red(`[${this.getTimestamp()}] ERROR: ${formattedMessage}`));
            this.sendLogToWs('error', formattedMessage);
        }
    }

    warn(message, ...args) {
        if (this.shouldLog('warn')) {
            const formattedMessage = this.formatMessage(message, ...args);
            console.warn(colorize.yellow(`[${this.getTimestamp()}] WARNING: ${formattedMessage}`));
            this.sendLogToWs('warn', formattedMessage);
        }
    }

    warning(message, ...args) {
        if (this.shouldLog('warn')) {
            const formattedMessage = this.formatMessage(message, ...args);
            console.warn(colorize.yellow(`[${this.getTimestamp()}] WARNING: ${formattedMessage}`));
            this.sendLogToWs('warn', formattedMessage);
        }
    }

    info(message, ...args) {
        if (this.shouldLog('info')) {
            const formattedMessage = this.formatMessage(message, ...args);
            console.info(colorize.white(`[${this.getTimestamp()}] INFO: ${formattedMessage}`));
            this.sendLogToWs('info', formattedMessage);
        }
    }

    debug(message, ...args) {
        if (this.debugMode && this.shouldLog('debug')) {
            const formattedMessage = this.formatMessage(message, ...args);
            console.log(colorize.debug(`[${this.getTimestamp()}] DEBUG: ${formattedMessage}`));
            this.sendLogToWs('debug', formattedMessage);
        }
    }

    logObject(obj, label = 'Object') {
        if (this.shouldLog('info')) {
            console.log(colorize.blue(`[${this.getTimestamp()}] ${label}:`));
            console.log(util.inspect(obj, { colors: true, depth: null }));
            this.sendLogToWs('info', util.inspect(obj, { colors: true, depth: null }));
        }
    }

    async logExecutionTime(func, label = 'Execution') {
        if (this.shouldLog('info')) {
            const start = process.hrtime();
            const result = await func();
            const [seconds, nanoseconds] = process.hrtime(start);
            const duration = seconds * 1000 + nanoseconds / 1000000;

            console.log(colorize.cyan(`[${this.getTimestamp()}] ${label} Time: ${duration.toFixed(2)}ms`));
            this.sendLogToWs('info', `[${this.getTimestamp()}] ${label} Time: ${duration.toFixed(2)}ms`);
            return result;
        }
        return await func();
    }

    createScopedLogger(scope) {
        const scopedLogger = {};
        const methods = ['success', 'error', 'warning', 'info', 'debug'];

        methods.forEach(method => {
            scopedLogger[method] = (message, ...args) => {
                this[method](`[${scope}] ${message}`, ...args);
            };
        });

        return scopedLogger;
    }

    setLogLevel(level) {
        if (this.logLevels.hasOwnProperty(level)) {
            this.logLevel = level;
            this.info(`Log level set to: ${level}`);
        } else {
            this.error(`Invalid log level: ${level}`);
        }
    }

    setDebugMode(enabled) {
        this.debugMode = enabled;
        this.info(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    group(label) {
        if (this.shouldLog('info')) {
            console.group(colorize.cyan(`[${this.getTimestamp()}] ${label}`));
        }
    }

    groupEnd() {
        if (this.shouldLog('info')) {
            console.groupEnd();
        }
    }

    custom(message, color, ...args) {
        if (this.shouldLog('info') && colors[color]) {
            const formattedMessage = this.formatMessage(message, ...args);
            console.log(`${colors[color]}[${this.getTimestamp()}] ${formattedMessage}${colors.reset}`);
            this.sendLogToWs('info', formattedMessage);
        }
    }

    /**
     * Clear the refresh area
     */
    clearRefresh() {
        if (this.lastLineCount > 0) {
            readline.moveCursor(process.stdout, 0, -this.lastLineCount);
            readline.clearScreenDown(process.stdout);
            this.lastLineCount = 0;
        }
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
     * Log message with interval control and message counting per namespace
     * @param {string} message - Message to log
     * @param {number} intervalSeconds - Minimum interval between logs in seconds
     * @param {string} [namespace='_default'] - Namespace for the log
     * @param {string} [logLevel='info'] - Log level to use (error, warn, info, debug, etc.)
     */
    interval(message, intervalSeconds, namespace = '_default', logLevel = 'info') {
        // Initialize stats for new namespace
        if (!this.namespaceStats[namespace]) {
            this.namespaceStats[namespace] = {
                lastLogTime: 0,
                lastAccessTime: Date.now(),
                skipCount: 0
            };
        }

        const stats = this.namespaceStats[namespace];
        const now = Date.now();
        const intervalMs = intervalSeconds * 1000;

        // Update last access time
        stats.lastAccessTime = now;

        // Clean up inactive namespaces (except current and default)
        const INACTIVE_THRESHOLD = 60000; // 1 minute
        let cleanedCount = 0;
        Object.entries(this.namespaceStats).forEach(([ns, nsStats]) => {
            if (ns !== '_default' && ns !== namespace && now - nsStats.lastAccessTime > INACTIVE_THRESHOLD) {
                if (nsStats.skipCount > 0) {
                    this.debug(`[${ns}] Cleaned up inactive namespace with ${nsStats.skipCount} skipped messages`);
                }
                delete this.namespaceStats[ns];
                cleanedCount++;
            }
        });

        if (cleanedCount > 0) {
            this.debug(`Cleaned up ${cleanedCount} inactive namespace(s)`);
        }

        // First time logging in this namespace
        if (stats.lastLogTime === 0) {
            this[logLevel](`[${namespace}] ${message}`);
            stats.lastLogTime = now;
            return;
        }

        // Check if enough time has passed
        if (now - stats.lastLogTime >= intervalMs) {
            // If there were skipped messages, include them in the log
            if (stats.skipCount > 0) {
                this[logLevel](`[${namespace}] ${message} (Skipped ${stats.skipCount} messages)`);
                stats.skipCount = 0;
            } else {
                this[logLevel](`[${namespace}] ${message}`);
            }
            stats.lastLogTime = now;
        } else {
            // Increment skip counter if not enough time has passed
            stats.skipCount++;
        }
    }

    /**
     * Refresh message(s) on screen
     * @param {string|string[]} message - Message to display (string or array of strings)
     * @param {string} logLevel - Log level (info, warn, error, success)
     */
    refresh(message, logLevel = 'info') {
        if (!this.shouldLog(logLevel)) return;

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
            readline.moveCursor(process.stdout, 0, -this.lastLineCount);
            readline.clearScreenDown(process.stdout);
        }

        // Write new lines with timestamp and color
        lines.forEach(line => {
            process.stdout.write(colorFunc(`[${this.getTimestamp()}] ${line}\n`));
        });

        // Update line count
        this.lastLineCount = lines.length;
    }
}

// Export only the logger instance
module.exports = new Logger();
