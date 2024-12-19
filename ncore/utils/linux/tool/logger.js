const fs = require('fs');
    const path = require('path');

    const colorMap = {
        info: '\x1b[34m',    // Blue
        success: '\x1b[32m', // Green
        warn: '\x1b[33m',    // Yellow
        error: '\x1b[31m',   // Red
        debug: '\x1b[36m',   // Cyan
        trace: '\x1b[35m',   // Magenta
        reset: '\x1b[0m'     // Reset
    };

    /**
     * Format log message with timestamp
     * @param {string} level - Log level
     * @param {Array} args - Arguments to log
     * @returns {string} - Formatted log message
     */
    function formatLogMessage(level, args) {
        const timestamp = new Date().toISOString();
        const messages = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        );
        return `[${timestamp}] [${level.toUpperCase()}] ${messages.join(' ')}`;
    }

    /**
     * Write log to file
     * @param {string} logPath - Path to log file
     * @param {string} message - Message to log
     */
    function writeToFile(logPath, message) {
        if (!logPath) return;
        
        const logDir = path.dirname(logPath);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        fs.appendFileSync(logPath, message + '\n');
    }

    /**
     * Logger class for handling console and file logging
     */
    class Logger {
        constructor(options = {}) {
            this.logPath = options.logPath || '';
            this.logToConsole = options.logToConsole !== false;
            this.logToFile = options.logToFile !== false;
            this.colorEnabled = options.colorEnabled !== false;
            this.logLevel = options.logLevel || 'info';
            
            // Log levels priority
            this.logLevels = {
                error: 0,
                warn: 1,
                info: 2,
                success: 2,
                debug: 3,
                trace: 4
            };
        }

        /**
         * Check if the log level is enabled
         * @param {string} level - Log level to check
         * @returns {boolean} - Whether the log level is enabled
         */
        shouldLog(level) {
            return this.logLevels[level] <= this.logLevels[this.logLevel];
        }

        /**
         * Log message with color
         * @param {string} level - Log level
         * @param  {...any} args - Arguments to log
         */
        log(level, ...args) {
            if (!this.shouldLog(level)) return;

            const message = formatLogMessage(level, args);
            
            if (this.logToConsole) {
                const color = this.colorEnabled ? colorMap[level] || '' : '';
                const reset = this.colorEnabled ? colorMap.reset : '';
                console.log(`${color}${message}${reset}`);
            }

            if (this.logToFile && this.logPath) {
                writeToFile(this.logPath, message);
            }
        }

        /**
         * Set log file path
         * @param {string} path - Path to log file
         */
        setLogPath(path) {
            this.logPath = path;
        }

        /**
         * Set log level
         * @param {string} level - Log level to set
         */
        setLogLevel(level) {
            if (this.logLevels.hasOwnProperty(level)) {
                this.logLevel = level;
            }
        }

        /**
         * Enable or disable console logging
         * @param {boolean} enabled - Whether to enable console logging
         */
        setConsoleLogging(enabled) {
            this.logToConsole = enabled;
        }

        /**
         * Enable or disable file logging
         * @param {boolean} enabled - Whether to enable file logging
         */
        setFileLogging(enabled) {
            this.logToFile = enabled;
        }

        /**
         * Enable or disable color output
         * @param {boolean} enabled - Whether to enable color output
         */
        setColorOutput(enabled) {
            this.colorEnabled = enabled;
        }

        // Convenience methods for different log levels
        error(...args) {
            this.log('error', ...args);
        }

        warn(...args) {
            this.log('warn', ...args);
        }

        info(...args) {
            this.log('info', ...args);
        }

        success(...args) {
            this.log('success', ...args);
        }

        debug(...args) {
            this.log('debug', ...args);
        }

        trace(...args) {
            this.log('trace', ...args);
        }
    }

    // Create default logger instance
    const defaultLogger = new Logger();

    // Export convenience functions that use the default logger
    exports.error = (...args) => defaultLogger.error(...args);
    exports.warn = (...args) => defaultLogger.warn(...args);
    exports.info = (...args) => defaultLogger.info(...args);
    exports.success = (...args) => defaultLogger.success(...args);
    exports.debug = (...args) => defaultLogger.debug(...args);
    exports.trace = (...args) => defaultLogger.trace(...args);

    // Export default logger instance
    module.exports = defaultLogger;