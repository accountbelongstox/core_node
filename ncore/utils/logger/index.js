const util = require('util');
const readline = require('readline');

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
    command: '\x1b[35m'
};

// Color wrapper functions
const colorize = {
    green: (text) => `${colors.green}${text}${colors.reset}`,
    white: (text) => `${colors.white}${text}${colors.reset}`,
    red: (text) => `${colors.red}${text}${colors.reset}`,
    yellow: (text) => `${colors.yellow}${text}${colors.reset}`,
    blue: (text) => `${colors.blue}${text}${colors.reset}`,
    gray: (text) => `${colors.gray}${text}${colors.reset}`,
    cyan: (text) => `${colors.cyan}${text}${colors.reset}`,
    command: (text) => `${colors.command}${text}${colors.reset}`
};

class Logger {
    constructor() {
        this.debugMode = process.env.DEBUG || false;
        this.logLevel = process.env.LOG_LEVEL || 'info';
        this.logLevels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        this.lastLineCount = 0;
        this.progressBarWidth = 40; // Default progress bar width
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
        }
    }

    command(message, ...args) {
        if (this.shouldLog('info')) {
            const formattedMessage = this.formatMessage(message, ...args);
            console.log(colorize.command(`[${this.getTimestamp()}] COMMAND: ${formattedMessage}`));
        }
    }

    error(message, ...args) {
        if (this.shouldLog('error')) {
            const formattedMessage = this.formatMessage(message, ...args);
            console.error(colorize.red(`[${this.getTimestamp()}] ERROR: ${formattedMessage}`));
        }
    }

    warn(message, ...args) {
        if (this.shouldLog('warn')) {
            const formattedMessage = this.formatMessage(message, ...args);
            console.warn(colorize.yellow(`[${this.getTimestamp()}] WARNING: ${formattedMessage}`));
        }
    }

    warning(message, ...args) {
        if (this.shouldLog('warn')) {
            const formattedMessage = this.formatMessage(message, ...args);
            console.warn(colorize.yellow(`[${this.getTimestamp()}] WARNING: ${formattedMessage}`));
        }
    }

    info(message, ...args) {
        if (this.shouldLog('info')) {
            const formattedMessage = this.formatMessage(message, ...args);
            console.info(colorize.white(`[${this.getTimestamp()}] INFO: ${formattedMessage}`));
        }
    }

    debug(message, ...args) {
        if (this.debugMode && this.shouldLog('debug')) {
            const formattedMessage = this.formatMessage(message, ...args);
            console.debug(colorize.gray(`[${this.getTimestamp()}] DEBUG: ${formattedMessage}`));
        }
    }

    logObject(obj, label = 'Object') {
        if (this.shouldLog('info')) {
            console.log(colorize.blue(`[${this.getTimestamp()}] ${label}:`));
            console.log(util.inspect(obj, { colors: true, depth: null }));
        }
    }

    async logExecutionTime(func, label = 'Execution') {
        if (this.shouldLog('info')) {
            const start = process.hrtime();
            const result = await func();
            const [seconds, nanoseconds] = process.hrtime(start);
            const duration = seconds * 1000 + nanoseconds / 1000000;
            
            console.log(colorize.cyan(`[${this.getTimestamp()}] ${label} Time: ${duration.toFixed(2)}ms`));
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
        }
    }

    /**
     * Clear previous lines and print new content
     * @param {string|string[]} content - Content to print
     */
    refresh(content) {
        if (!this.shouldLog('info')) return;

        const lines = Array.isArray(content) ? content : [content];
        
        // Clear previous lines
        if (this.lastLineCount > 0) {
            readline.moveCursor(process.stdout, 0, -this.lastLineCount);
            readline.clearScreenDown(process.stdout);
        }

        // Print new lines with timestamp
        lines.forEach(line => {
            process.stdout.write(colorize.white(`[${this.getTimestamp()}] ${line}\n`));
        });

        this.lastLineCount = lines.length;
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
}

// Create singleton instance
const logger = new Logger();

// Export the logger instance
module.exports = logger;

// Also export the Logger class for extensibility
module.exports.Logger = Logger;

// Export utility functions
module.exports.createScopedLogger = (scope) => logger.createScopedLogger(scope);
module.exports.setLogLevel = (level) => logger.setLogLevel(level);
module.exports.setDebugMode = (enabled) => logger.setDebugMode(enabled); 