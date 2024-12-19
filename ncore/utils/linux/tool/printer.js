const util = require('util');

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    underscore: '\x1b[4m',
    blink: '\x1b[5m',
    reverse: '\x1b[7m',
    hidden: '\x1b[8m',
    
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    
    bgBlack: '\x1b[40m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
    bgWhite: '\x1b[47m'
};

/**
 * Format text with color
 * @param {string} text - Text to format
 * @param {string} color - Color to apply
 * @returns {string} - Formatted text
 */
exports.colorize = function(text, color) {
    const colorCode = colors[color] || '';
    return `${colorCode}${text}${colors.reset}`;
};

/**
 * Print text with color
 * @param {string} text - Text to print
 * @param {string} [color='white'] - Color to use
 */
exports.print = function(text, color = 'white') {
    console.log(exports.colorize(text, color));
};

/**
 * Print success message
 * @param {string} text - Message to print
 */
exports.success = function(text) {
    exports.print(text, 'green');
};

/**
 * Print error message
 * @param {string} text - Message to print
 */
exports.error = function(text) {
    exports.print(text, 'red');
};

/**
 * Print warning message
 * @param {string} text - Message to print
 */
exports.warn = function(text) {
    exports.print(text, 'yellow');
};

/**
 * Print info message
 * @param {string} text - Message to print
 */
exports.info = function(text) {
    exports.print(text, 'blue');
};

/**
 * Print debug message
 * @param {string} text - Message to print
 */
exports.debug = function(text) {
    exports.print(text, 'magenta');
};

/**
 * Print object with formatting
 * @param {any} obj - Object to print
 * @param {number} [depth=2] - Depth for object inspection
 * @param {boolean} [colors=true] - Whether to use colors
 */
exports.printObject = function(obj, depth = 2, colors = true) {
    console.log(util.inspect(obj, {
        depth,
        colors,
        maxArrayLength: null,
        maxStringLength: null
    }));
};

/**
 * Print table from array of objects
 * @param {Array<object>} data - Array of objects to print as table
 * @param {Array<string>} [columns] - Columns to include
 */
exports.printTable = function(data, columns) {
    if (!Array.isArray(data) || data.length === 0) {
        exports.warn('No data to display');
        return;
    }

    // Get columns if not provided
    if (!columns) {
        columns = Object.keys(data[0]);
    }

    // Calculate column widths
    const widths = {};
    columns.forEach(col => {
        widths[col] = col.length;
        data.forEach(row => {
            const cellValue = String(row[col] || '');
            widths[col] = Math.max(widths[col], cellValue.length);
        });
    });

    // Print header
    const header = columns.map(col => 
        col.padEnd(widths[col])
    ).join(' | ');
    
    const separator = columns.map(col => 
        '-'.repeat(widths[col])
    ).join('-+-');

    exports.print(header, 'cyan');
    exports.print(separator, 'dim');

    // Print rows
    data.forEach(row => {
        const rowStr = columns.map(col => 
            String(row[col] || '').padEnd(widths[col])
        ).join(' | ');
        exports.print(rowStr);
    });
};

/**
 * Clear console
 */
exports.clear = function() {
    process.stdout.write('\x1Bc');
};

/**
 * Print progress bar
 * @param {number} current - Current value
 * @param {number} total - Total value
 * @param {number} [width=50] - Width of progress bar
 * @param {string} [color='green'] - Color of progress bar
 */
exports.progressBar = function(current, total, width = 50, color = 'green') {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round((width * current) / total);
    const empty = width - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const text = `Progress: [${exports.colorize(bar, color)}] ${percentage}%`;
    
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(text);

    if (current === total) {
        process.stdout.write('\n');
    }
};

module.exports = {
    print: exports.print,
    success: exports.success,
    error: exports.error,
    warn: exports.warn,
    info: exports.info,
    debug: exports.debug,
    printObject: exports.printObject,
    printTable: exports.printTable,
    clear: exports.clear,
    progressBar: exports.progressBar,
    colorize: exports.colorize,
    colors
};