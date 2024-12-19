const util = require('util');

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    gray: '\x1b[90m',
    cyan: '\x1b[36m'
};

// Color wrapper functions
const colorize = {
    green: (text) => `${colors.green}${text}${colors.reset}`,
    red: (text) => `${colors.red}${text}${colors.reset}`,
    yellow: (text) => `${colors.yellow}${text}${colors.reset}`,
    blue: (text) => `${colors.blue}${text}${colors.reset}`,
    gray: (text) => `${colors.gray}${text}${colors.reset}`,
    cyan: (text) => `${colors.cyan}${text}${colors.reset}`
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

    error(message, ...args) {
        if (this.shouldLog('error')) {
            const formattedMessage = this.formatMessage(message, ...args);
            console.error(colorize.red(`[${this.getTimestamp()}] ERROR: ${formattedMessage}`));
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
            console.info(colorize.blue(`[${this.getTimestamp()}] INFO: ${formattedMessage}`));
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