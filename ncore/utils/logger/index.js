import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger, format, transports } from 'winston';

function mkdir(path) {
    return fs.mkdirSync(path, { recursive: true });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, '..', '..', '..', 'logs');
mkdir(LOG_DIR);

// ANSI Color codes
const COLORS = {
    red: '\x1b[91m',
    green: '\x1b[92m',
    yellow: '\x1b[93m',
    blue: '\x1b[94m',
    purple: '\x1b[95m',
    cyan: '\x1b[96m',
    white: '\x1b[97m',
    end: '\x1b[0m'
};

// Log file configuration
const MAX_LOG_SIZE = 100 * 1024 * 1024;
const LOG_FILES = {
    info: 'info.log',
    error: 'error.log',
    warning: 'warning.log',
    debug: 'debug.log'
};

const fileFormat = format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({ timestamp, level, message }) => {
        return `[${timestamp}] ${level.toUpperCase().padEnd(8)} ${message}`;
    })
);

const consoleFormat = format.printf(({ level, message }) => message);

// Create loggers for each level
const loggers = {};

function getLogger(level) {
    if (!loggers[level]) {
        loggers[level] = createLogger({
            transports: [
                // File transport
                new transports.File({
                    filename: path.join(LOG_DIR, LOG_FILES[level]),
                    maxsize: MAX_LOG_SIZE,
                    maxFiles: 1,
                    format: fileFormat
                }),
                // Console transport
                new transports.Console({
                    format: consoleFormat
                })
            ]
        });
    }
    return loggers[level];
}

function formatMessage(...args) {
    return args.map(arg => {
        if (typeof arg === 'object') {
            return JSON.stringify(arg, null, 2);
        }
        return String(arg);
    }).join(' ');
}

function logWithColor(level, color, ...args) {
    const message = formatMessage(...args);
    const coloredMessage = `${COLORS[color]}${message}${COLORS.end}`;
    getLogger(level).log(level, coloredMessage);
}

// Export logging functions
export default {
    info(...args) {
        logWithColor('info', 'cyan', ...args);
    },

    error(...args) {
        logWithColor('error', 'red', ...args);
    },

    warning(...args) {
        logWithColor('warning', 'yellow', ...args);
    },

    debug(...args) {
        logWithColor('debug', 'white', ...args);
    },

    success(...args) {
        logWithColor('info', 'green', ...args);
    }
}; 