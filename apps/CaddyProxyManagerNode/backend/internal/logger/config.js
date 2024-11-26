import config from '../../config/index.js';

export const LogLevels = {
    DEBUG: config.log.level.DEBUG || 10,
    INFO: config.log.level.INFO || 20,
    WARN: config.log.level.WARN || 30,
    ERROR: config.log.level.ERROR || 40
};

export class LoggerConfig {
    constructor() {
        this.logThreshold = LogLevels.DEBUG;
        this.formatter = 'nice';
    }

    validate() {
        const validLevels = Object.values(LogLevels);
        if (!validLevels.includes(this.logThreshold)) {
            throw new Error(`Invalid log level: ${this.logThreshold}`);
        }
    }
}

module.exports = {
    LogLevels,
    LoggerConfig
}; 