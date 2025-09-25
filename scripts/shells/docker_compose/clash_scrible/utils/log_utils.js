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

const fs = require('fs').promises;
const path = require('path');
const { log_dir } = require('../provider/global_var');
const { broadcastMessage } = require('../express/websocket');

// ANSI 颜色代码
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    gray: '\x1b[90m',
    white: '\x1b[37m'
};

class Logger {
    constructor(logFilePath, maxLines = 1000) {
        this.logFilePath = logFilePath;
        this.maxLines = maxLines;
    }

    async logWithColor(message, color) {
        const timestamp = new Date().toISOString();
        const logMessage = `${timestamp} - ${message}\n`;

        console.log(colors[color] + message + colors.reset);

        try {
            await fs.appendFile(this.logFilePath, logMessage);
            await this.trimLog();
            
            // Broadcast the log message
            broadcastMessage(
                { message: message,color, timestamp: timestamp },
                'log',
                color
            );
        } catch (error) {
            console.error(`Error writing to log file: ${error}`);
        }
    }

    async log(message) {
        await this.logWithColor(message, 'white');
    }

    async logGreen(message) {
        await this.logWithColor(message, 'green');
    }

    async logYellow(message) {
        await this.logWithColor(message, 'yellow');
    }

    async logBlue(message) {
        await this.logWithColor(message, 'blue');
    }

    async logRed(message) {
        await this.logWithColor(message, 'red');
    }

    async logGray(message) {
        await this.logWithColor(message, 'gray');
    }

    async trimLog() {
        try {
            const content = await fs.readFile(this.logFilePath, 'utf8');
            const lines = content.split('\n');
            if (lines.length > this.maxLines) {
                const trimmedLines = lines.slice(-this.maxLines);
                await fs.writeFile(this.logFilePath, trimmedLines.join('\n'));
            }
        } catch (error) {
            console.error(`Error trimming log file: ${error}`);
        }
    }
}

const logger = new Logger(path.join(log_dir, 'app.log'));

module.exports = logger;