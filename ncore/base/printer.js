import util from 'util';
import process from 'process';

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

class Printer {
    constructor() {
        this.indentLevel = 0;
        this.indentSize = 2;
    }

    // Basic printing methods with colors
    log(...args) {
        console.log(this._indent(args.join(' ')));
        return this;
    }

    success(...args) {
        console.log(this._colorize(this._indent(args.join(' ')), 'green'));
        return this;
    }

    error(...args) {
        console.error(this._colorize(this._indent(args.join(' ')), 'red'));
        return this;
    }

    warn(...args) {
        console.warn(this._colorize(this._indent(args.join(' ')), 'yellow'));
        return this;
    }

    info(...args) {
        console.info(this._colorize(this._indent(args.join(' ')), 'blue'));
        return this;
    }

    debug(...args) {
        console.debug(this._colorize(this._indent(args.join(' ')), 'magenta'));
        return this;
    }

    // Additional color methods
    primary(...args) {
        console.log(this._colorize(this._indent(args.join(' ')), 'cyan'));
        return this;
    }

    secondary(...args) {
        console.log(this._colorize(this._indent(args.join(' ')), 'magenta'));
        return this;
    }

    highlight(...args) {
        console.log(this._colorize(this._indent(args.join(' ')), 'yellow'));
        return this;
    }

    // Format methods
    bold(...args) {
        console.log(this._colorize(this._indent(args.join(' ')), 'bright'));
        return this;
    }

    dim(...args) {
        console.log(this._colorize(this._indent(args.join(' ')), 'dim'));
        return this;
    }

    underline(...args) {
        console.log(this._colorize(this._indent(args.join(' ')), 'underscore'));
        return this;
    }

    // Structure methods
    title(...args) {
        this.line('=', 50)
            .bold(args.join(' '))
            .line('=', 50);
        return this;
    }

    subtitle(...args) {
        this.line('-', 40)
            .primary(args.join(' '))
            .line('-', 40);
        return this;
    }

    section(...args) {
        this.blank()
            .primary('▶', args.join(' '))
            .line('-', 30);
        return this;
    }

    // Utility methods
    line(char = '-', length = 40) {
        this.log(char.repeat(length));
        return this;
    }

    blank(count = 1) {
        for (let i = 0; i < count; i++) {
            console.log('');
        }
        return this;
    }

    clear() {
        process.stdout.write('\x1Bc');
        return this;
    }

    clearLine() {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        return this;
    }

    // Indentation methods
    indent() {
        this.indentLevel++;
        return this;
    }

    outdent() {
        if (this.indentLevel > 0) {
            this.indentLevel--;
        }
        return this;
    }

    resetIndent() {
        this.indentLevel = 0;
        return this;
    }

    // Data structure printing
    json(data, indent = 2) {
        this.log(JSON.stringify(data, null, indent));
        return this;
    }

    table(data, columns) {
        if (!Array.isArray(data) || data.length === 0) {
            this.warn('No data to display');
            return this;
        }

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

        this.primary(header)
            .dim(separator);

        // Print rows
        data.forEach(row => {
            const rowStr = columns.map(col => 
                String(row[col] || '').padEnd(widths[col])
            ).join(' | ');
            this.log(rowStr);
        });

        return this;
    }

    list(items, bullet = '•') {
        items.forEach(item => {
            this.log(`${bullet} ${item}`);
        });
        return this;
    }

    tree(obj, prefix = '') {
        Object.entries(obj).forEach(([key, value], index, array) => {
            const isLast = index === array.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const childPrefix = isLast ? '    ' : '│   ';
            
            this.log(prefix + connector + key);
            
            if (typeof value === 'object' && value !== null) {
                this.tree(value, prefix + childPrefix);
            }
        });
        return this;
    }

    // Progress indicators
    progress(current, total, width = 50, color = 'green') {
        const percentage = Math.round((current / total) * 100);
        const filled = Math.round((width * current) / total);
        const empty = width - filled;
        
        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        const text = `Progress: [${this._colorize(bar, color)}] ${percentage}%`;
        
        this.clearLine();
        process.stdout.write(text);
        
        if (current === total) {
            process.stdout.write('\n');
        }
        return this;
    }

    spinner(text = 'Loading...') {
        const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        let i = 0;
        
        return setInterval(() => {
            const frame = frames[i = ++i % frames.length];
            this.clearLine();
            process.stdout.write(`${frame} ${text}`);
        }, 80);
    }

    stopSpinner(interval) {
        clearInterval(interval);
        this.clearLine();
        return this;
    }

    // Helper methods
    _indent(text) {
        const indent = ' '.repeat(this.indentLevel * this.indentSize);
        return text.split('\n').map(line => indent + line).join('\n');
    }

    _colorize(text, color) {
        const colorCode = colors[color] || '';
        return `${colorCode}${text}${colors.reset}`;
    }
}

// Create default instance
const printer = new Printer();

// Main test function
function main() {
    printer.clear()
        .title('Printer Test')
        .section('Basic Printing')
        .log('Normal log message')
        .success('Success message')
        .error('Error message')
        .warn('Warning message')
        .info('Info message')
        .debug('Debug message')
        .blank()
        
        .section('Color and Format')
        .primary('Primary text')
        .secondary('Secondary text')
        .highlight('Highlighted text')
        .bold('Bold text')
        .dim('Dimmed text')
        .underline('Underlined text')
        .blank()
        
        .section('Data Structures')
        .json({ name: 'Test', value: 123 })
        .blank()
        
        .list(['Item 1', 'Item 2', 'Item 3'])
        .blank()
        
        .tree({
            root: {
                branch1: {
                    leaf1: 'value1',
                    leaf2: 'value2'
                },
                branch2: 'value3'
            }
        })
        .blank()
        
        .section('Progress Indicators')
        .info('Progress bar test:');

    // Test progress bar
    for (let i = 0; i <= 100; i += 10) {
        printer.progress(i, 100);
        // Simulate work
        for (let j = 0; j < 1000000; j++) {}
    }

    // Test spinner
    const spinnerInterval = printer.spinner('Processing...');
    setTimeout(() => {
        printer.stopSpinner(spinnerInterval)
            .success('Done!');
    }, 3000);
}

// Run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { Printer, printer as default }; 