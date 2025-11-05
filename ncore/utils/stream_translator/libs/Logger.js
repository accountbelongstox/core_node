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
