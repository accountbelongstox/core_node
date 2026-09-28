class Logger {
    constructor(options = {}) {
        this.enableDebug = options.enableDebug || process.env.DEBUG === 'true';
        this.enableInfo = options.enableInfo !== false;
        this.enableWarn = options.enableWarn !== false;
        this.enableError = options.enableError !== false;
        this.prefix = options.prefix || '[StreamTranslator]';
    }

    formatMessage(level, message) {
        const timestamp = new Date().toISOString();
        return timestamp + ' ' + level + ' ' + this.prefix + ' ' + message;
    }

    debug(message) {
        if (this.enableDebug) {
            console.log(this.formatMessage('[DEBUG]', message));
        }
    }

    info(message) {
        if (this.enableInfo) {
            console.log(this.formatMessage('[INFO]', message));
        }
    }

    warn(message) {
        if (this.enableWarn) {
            console.warn(this.formatMessage('[WARN]', message));
        }
    }

    error(message) {
        if (this.enableError) {
            console.error(this.formatMessage('[ERROR]', message));
        }
    }

    log(message) {
        console.log(message);
    }
}

const defaultLogger = new Logger();

module.exports = defaultLogger;
module.exports.Logger = Logger;
