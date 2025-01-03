const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', '..', '..', '..', 'logs');

// Create directory if not exists
function mkdir(path) {
    return fs.mkdirSync(path, { recursive: true });
}

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
const MAX_LOG_SIZE = 100 * 1024 * 1024; // 100MB
const LOG_FILES = {
    info: 'info.log',
    error: 'error.log',
    warning: 'warning.log',
    debug: 'debug.log'
};

// Format timestamp
function getTimestamp() {
    return new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
}

// Format message for logging
function formatMessage() {
    return Array.from(arguments).map(function (arg) {
        if (typeof arg === 'object') {
            return JSON.stringify(arg, null, 2);
        }
        return String(arg);
    }).join(' ');
}

// File rotation logic
function rotateLogFile(filePath) {
    if (!fs.existsSync(filePath)) return;

    const stats = fs.statSync(filePath);
    if (stats.size >= MAX_LOG_SIZE) {
        const backupPath = `${filePath}.1`;
        if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
        }
        fs.renameSync(filePath, backupPath);
    }
}

// Write to log file
function writeToFile(level, message) {
    const filePath = path.join(LOG_DIR, LOG_FILES[level]);
    const formattedMessage = '[' + getTimestamp() + '] ' + level.toUpperCase().padEnd(8) + ' ' + message + '\n';

    rotateLogFile(filePath);

    try {
        fs.appendFileSync(filePath, formattedMessage);
    } catch (error) {
        console.error('Error writing to log file:', error);
    }
}

// Log with color to console and file
function logWithColor(level, color) {
    const message = formatMessage.apply(null, Array.from(arguments).slice(2));
    const coloredMessage = COLORS[color] + message + COLORS.end;

    // Console output
    console.log(coloredMessage);

    // File output
    writeToFile(level, message);
}

// Export logging functions
exports.info = function () {
    logWithColor('info', 'cyan', ...arguments);
};
exports.log = function () {
    logWithColor('info', 'cyan', ...arguments);
};

exports.error = function () {
    logWithColor('error', 'red', ...arguments);
};

exports.warning = function () {
    logWithColor('warning', 'yellow', ...arguments);
};
exports.warn = function () {
    logWithColor('warning', 'yellow', ...arguments);
};

exports.debug = function () {
    logWithColor('debug', 'white', ...arguments);
};

exports.success = function () {
    logWithColor('info', 'green', ...arguments);
};