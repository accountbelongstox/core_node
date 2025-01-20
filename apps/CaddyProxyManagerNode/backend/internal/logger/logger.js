const chalk = require('chalk');
const config = require('../../config/index.js');

class Logger {
    #config;

    constructor() {
        this.#config = {
            logThreshold: config.log.level.INFO,
            formatter: config.log.format
        };
    }

    configure(config) {
        if (!config) {
            throw new Error('A non nil Config is mandatory');
        }

        this.#config = {
            ...this.#config,
            ...config
        };
    }

    formatMessage(level, message, errorClass = '') {
        const timestamp = new Date().toISOString();

        if (this.#config.formatter === 'json') {
            return JSON.stringify({
                timestamp,
                level: this.#getLevelName(level),
                message,
                pid: process.pid,
                errorClass: errorClass || undefined
            });
        }

        const levelColor = this.#getLevelColor(level);
        const levelName = this.#getLevelName(level);

        return [
            chalk.black('['),
            chalk.white(new Date().toLocaleString()),
            chalk.black('] '),
            levelColor(levelName.toString().padEnd(8)),
            chalk.gray(errorClass ? `${errorClass}: ${message}` : message)
        ].join('');
    }

    #getLevelName(level) {
        switch (level) {
            case config.log.level.DEBUG: return 'DEBUG';
            case config.log.level.INFO: return 'INFO';
            case config.log.level.WARN: return 'WARN';
            case config.log.level.ERROR: return 'ERROR';
            default: return 'UNKNOWN';
        }
    }

    #getLevelColor(level) {
        switch (level) {
            case config.log.level.DEBUG: return chalk.magenta;
            case config.log.level.INFO: return chalk.blue;
            case config.log.level.WARN: return chalk.yellow;
            case config.log.level.ERROR: return chalk.red;
            default: return chalk.white;
        }
    }

    debug(...args) { this.#log(config.log.level.DEBUG, ...args); }
    info(...args) { this.#log(config.log.level.INFO, ...args); }
    warn(...args) { this.#log(config.log.level.WARN, ...args); }
    error(errorClass, error) {
        this.#log(config.log.level.ERROR, error.message, [], errorClass);
        if (this.#config.logThreshold === config.log.level.DEBUG) {
            console.error(error.stack);
        }
    }

    #log(level, format, args = [], errorClass = '') {
        if (level < this.#config.logThreshold) {
            return;
        }

        const message = args.length ? format.replace(/%[sdj]/g, () => args.shift()) : format;
        console.log(this.formatMessage(level, message, errorClass));
    }
}

const logger = new Logger();

module.exports = {
    configure: logger.configure,
    debug: logger.debug,
    info: logger.info,
    warn: logger.warn,
    error: logger.error,
    Logger: Logger
};