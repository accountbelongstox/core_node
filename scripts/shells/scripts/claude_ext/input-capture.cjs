// Claude Input Capture Library
// Captures submit and onchange events in real-time

const fs = require('fs');
const path = require('path');

class InputCapture {
    constructor() {
        // Generate unique session ID
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        this.sessionId = `input-${timestamp}`;

        // Create log directory
        this.logDir = path.join(__dirname, 'input-logs');
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }

        // Create log file
        this.logFile = path.join(this.logDir, `${this.sessionId}.log`);

        // Initialize log file
        this.writeLog('='.repeat(60));
        this.writeLog(`Session started: ${new Date().toISOString()}`);
        this.writeLog('='.repeat(60));

        console.log(`[InputCapture] Logging to: ${this.logFile}`);
    }

    writeLog(message) {
        fs.appendFileSync(this.logFile, message + '\n', 'utf8');
    }

    captureSubmit(input, metadata = {}) {
        const timestamp = new Date().toISOString();

        this.writeLog('');
        this.writeLog(`[${timestamp}] SUBMIT`);
        this.writeLog(`Input: ${input}`);
        this.writeLog(`Length: ${input.length} characters`);

        if (Object.keys(metadata).length > 0) {
            this.writeLog(`Metadata: ${JSON.stringify(metadata)}`);
        }

        this.writeLog('-'.repeat(60));
    }

    captureChange(input, metadata = {}) {
        const timestamp = new Date().toISOString();

        this.writeLog('');
        this.writeLog(`[${timestamp}] CHANGE`);
        this.writeLog(`Input: ${input}`);
        this.writeLog(`Length: ${input.length} characters`);

        if (Object.keys(metadata).length > 0) {
            this.writeLog(`Metadata: ${JSON.stringify(metadata)}`);
        }
    }

    getLogPath() {
        return this.logFile;
    }
}

// Export singleton instance
let captureInstance = null;

function getCapture() {
    if (!captureInstance) {
        captureInstance = new InputCapture();
    }
    return captureInstance;
}

module.exports = {
    captureSubmit: (input, metadata) => getCapture().captureSubmit(input, metadata),
    captureChange: (input, metadata) => getCapture().captureChange(input, metadata),
    getLogPath: () => getCapture().getLogPath()
};
