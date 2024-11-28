import { DateTime } from 'luxon';

class Printer {
    // ANSI color codes
    static HEADER = '\x1b[95m';
    static OKBLUE = '\x1b[94m';
    static OKGREEN = '\x1b[92m';
    static WARNING = '\x1b[93m';
    static FAIL = '\x1b[91m';
    static ENDC = '\x1b[0m';
    static BOLD = '\x1b[1m';
    static UNDERLINE = '\x1b[4m';

    // Class variables
    static #lastPrintTimes = new Map();
    static #printLock = false;
    static PRINT_INTERVAL = 10000; // 10 seconds in milliseconds

    /**
     * Print messages only if enough time has passed since last print
     * @param  {...string} messages Messages to print
     * @returns {boolean} True if messages were printed
     */
    static printByLastTime(...messages) {
        if (!messages.length) return false;

        const message = messages.map(msg => String(msg)).join(' ');
        const currentTime = Date.now();

        // Simple lock mechanism
        while (this.#printLock) {
            // Busy wait
        }

        try {
            this.#printLock = true;
            
            // Check last print time for this message
            const lastTime = this.#lastPrintTimes.get(message);
            
            // First time printing this message
            if (!lastTime) {
                this.#lastPrintTimes.set(message, currentTime);
                this.info(message);
                return true;
            }
            
            // Check if enough time has passed
            if (currentTime - lastTime < this.PRINT_INTERVAL) {
                return false;
            }
            
            // Update last print time and print message
            this.#lastPrintTimes.set(message, currentTime);
            this.info(message);
            
            // Clean up old entries (keep last 1000 messages)
            if (this.#lastPrintTimes.size > 1000) {
                const entries = Array.from(this.#lastPrintTimes.entries())
                    .sort(([, a], [, b]) => a - b)
                    .slice(0, 100); // Remove oldest 100 entries
                
                entries.forEach(([msg]) => {
                    this.#lastPrintTimes.delete(msg);
                });
            }
            
            return true;
        } finally {
            this.#printLock = false;
        }
    }

    /**
     * Try to broadcast via WebSocket if available
     * @param {string} message Message to broadcast
     * @param {string} level Log level
     */
    static async #tryBroadcast(message, level) {
        try {
            const websocketHandler = await import('../../apps/http/websocket_handler.js');
            if (websocketHandler?.broadcastToAll) {
                websocketHandler.broadcastToAll('log', {
                    message: String(message),
                    level,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            if (!(error instanceof Error && error.code === 'MODULE_NOT_FOUND')) {
                console.error('Broadcast error:', error);
            }
        }
    }

    /**
     * Print messages with color and timestamp
     * @param {string} color ANSI color code
     * @param  {...string} messages Messages to print
     */
    static #printWithColor(color, ...messages) {
        const timestamp = new Date().toLocaleString();
        const message = messages.map(msg => String(msg)).join(' ');
        console.log(`${color}[${timestamp}] ${message}${this.ENDC}`);
    }

    // Public logging methods
    static info(...messages) {
        this.#printWithColor(this.OKBLUE, ...messages);
        this.#tryBroadcast(messages.join(' '), 'info');
    }

    static success(...messages) {
        this.#printWithColor(this.OKGREEN, ...messages);
        this.#tryBroadcast(messages.join(' '), 'success');
    }

    static warning(...messages) {
        this.#printWithColor(this.WARNING, ...messages);
        this.#tryBroadcast(messages.join(' '), 'warning');
    }

    static error(...messages) {
        this.#printWithColor(this.FAIL, ...messages);
        this.#tryBroadcast(messages.join(' '), 'error');
    }

    static debug(...messages) {
        this.#printWithColor(this.HEADER, ...messages);
        this.#tryBroadcast(messages.join(' '), 'debug');
    }

    /**
     * Start a test broadcast thread that prints messages periodically
     * @param {number} interval Time between messages in seconds
     * @returns {NodeJS.Timer} Interval timer
     */
    static startTestBroadcast(interval = 1) {
        let count = 0;
        
        const timer = setInterval(() => {
            try {
                const timestamp = new Date().toLocaleString();
                count++;
                
                // Rotate through different message types
                switch (count % 5) {
                    case 1:
                        this.info(`Test info message #${count} at ${timestamp}`);
                        break;
                    case 2:
                        this.success(`Test success message #${count} at ${timestamp}`);
                        break;
                    case 3:
                        this.warning(`Test warning message #${count} at ${timestamp}`);
                        break;
                    case 4:
                        this.error(`Test error message #${count} at ${timestamp}`);
                        break;
                    default:
                        this.debug(`Test debug message #${count} at ${timestamp}`);
                }
            } catch (error) {
                console.error('Error in test broadcast:', error);
            }
        }, interval * 1000);

        this.success(`Started test broadcast (interval: ${interval}s)`);
        return timer;
    }
}

// Export both the class and a global instance
export const cp = Printer;
export default Printer; 