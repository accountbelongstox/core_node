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

/**
 * Singleton Manager - Ensures only one instance runs on a port
 *
 * When starting:
 * 1. Check if port is occupied
 * 2. If occupied, request previous process to shutdown (if not busy)
 * 3. Wait for shutdown or timeout
 * 4. Start new instance
 */

const http = require('http');
const net = require('net');

// Import ThreadBus
const { getThreadBus } = require('#@thread_bus');

class SingletonManager {
    constructor() {
        this.isBusy = false;
        this.busyReason = null;
        this.shutdownCallbacks = [];
        this.activeOperations = 0;
    }

    /**
     * Check if a port is in use
     * @param {number} port - Port to check
     * @param {string} host - Host to check
     * @returns {Promise<boolean>}
     */
    async isPortInUse(port, host = '127.0.0.1') {
        return new Promise((resolve) => {
            const socket = new net.Socket();

            socket.setTimeout(1000);

            socket.on('connect', () => {
                socket.destroy();
                resolve(true);
            });

            socket.on('timeout', () => {
                socket.destroy();
                resolve(false);
            });

            socket.on('error', (err) => {
                socket.destroy();
                resolve(false);
            });

            socket.connect(port, host);
        });
    }

    /**
     * Request the existing process to shutdown
     * @param {number} port - Port of existing process
     * @param {string} host - Host of existing process
     * @param {number} timeout - Timeout in ms
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async requestShutdown(port, host = '127.0.0.1', timeout = 5000) {
        return new Promise((resolve) => {
            const options = {
                hostname: host,
                port: port,
                path: '/api/singleton/shutdown',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: timeout
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        resolve(result);
                    } catch (e) {
                        resolve({ success: false, message: 'Invalid response' });
                    }
                });
            });

            req.on('error', (err) => {
                resolve({ success: false, message: err.message });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({ success: false, message: 'Request timeout' });
            });

            req.write(JSON.stringify({ reason: 'New instance starting' }));
            req.end();
        });
    }

    /**
     * Wait for port to become available
     * @param {number} port - Port to wait for
     * @param {string} host - Host
     * @param {number} timeout - Max wait time in ms
     * @param {number} interval - Check interval in ms
     * @returns {Promise<boolean>}
     */
    async waitForPortAvailable(port, host = '127.0.0.1', timeout = 10000, interval = 500) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const inUse = await this.isPortInUse(port, host);
            if (!inUse) {
                return true;
            }
            await this.delay(interval);
        }

        return false;
    }

    /**
     * Try to take over from existing instance
     * @param {number} port - Port to take over
     * @param {string} host - Host
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async tryTakeover(port, host = '127.0.0.1') {
        console.log(`[SingletonManager] Checking if port ${port} is in use...`);

        const inUse = await this.isPortInUse(port, host);

        if (!inUse) {
            console.log(`[SingletonManager] Port ${port} is available`);
            return { success: true, message: 'Port is available' };
        }

        console.log(`[SingletonManager] Port ${port} is in use, requesting shutdown...`);

        const shutdownResult = await this.requestShutdown(port, host);

        if (!shutdownResult.success) {
            if (shutdownResult.busy) {
                console.log(`[SingletonManager] Existing process is busy: ${shutdownResult.reason}`);
                return {
                    success: false,
                    message: `Existing process is busy: ${shutdownResult.reason}`,
                    busy: true
                };
            }
            console.log(`[SingletonManager] Failed to request shutdown: ${shutdownResult.message}`);
            return { success: false, message: shutdownResult.message };
        }

        console.log(`[SingletonManager] Shutdown requested, waiting for port to become available...`);

        const available = await this.waitForPortAvailable(port, host);

        if (available) {
            console.log(`[SingletonManager] Port ${port} is now available`);
            return { success: true, message: 'Takeover successful' };
        }

        console.log(`[SingletonManager] Timeout waiting for port ${port} to become available`);
        return { success: false, message: 'Timeout waiting for port' };
    }

    /**
     * Set busy state
     * @param {boolean} busy - Whether busy
     * @param {string} reason - Reason for being busy
     */
    setBusy(busy, reason = null) {
        this.isBusy = busy;
        this.busyReason = reason;
    }

    /**
     * Start an operation (increments busy counter)
     * @param {string} operationName - Name of operation
     */
    startOperation(operationName) {
        this.activeOperations++;
        this.setBusy(true, operationName);
    }

    /**
     * End an operation (decrements busy counter)
     */
    endOperation() {
        this.activeOperations--;
        if (this.activeOperations <= 0) {
            this.activeOperations = 0;
            this.setBusy(false);
        }
    }

    /**
     * Check if can shutdown
     * @returns {{canShutdown: boolean, reason: string}}
     */
    canShutdown() {
        // Check ThreadBus first
        const threadBus = getThreadBus();
        const busCheck = threadBus.canShutdown();
        if (!busCheck.canShutdown) {
            return busCheck;
        }

        if (this.isBusy) {
            return {
                canShutdown: false,
                reason: this.busyReason || 'Process is busy'
            };
        }

        if (this.activeOperations > 0) {
            return {
                canShutdown: false,
                reason: `${this.activeOperations} active operations`
            };
        }

        return {
            canShutdown: true,
            reason: null
        };
    }

    /**
     * Register shutdown callback
     * @param {Function} callback - Callback to run on shutdown
     */
    onShutdown(callback) {
        this.shutdownCallbacks.push(callback);
    }

    /**
     * Execute shutdown
     * @param {string} reason - Reason for shutdown
     */
    async executeShutdown(reason = 'Requested') {
        console.log(`[SingletonManager] Executing shutdown: ${reason}`);

        // Use ThreadBus for coordinated shutdown
        const threadBus = getThreadBus();
        await threadBus.shutdown(reason, true);

        // Also run legacy callbacks
        for (const callback of this.shutdownCallbacks) {
            try {
                await callback();
            } catch (error) {
                console.error(`[SingletonManager] Shutdown callback error: ${error.message}`);
            }
        }

        setTimeout(() => {
            process.exit(0);
        }, 1000);
    }

    /**
     * Get status
     * @returns {Object}
     */
    getStatus() {
        return {
            isBusy: this.isBusy,
            busyReason: this.busyReason,
            activeOperations: this.activeOperations,
            canShutdown: this.canShutdown()
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

let instance = null;

function getInstance() {
    if (!instance) {
        instance = new SingletonManager();
    }
    return instance;
}

module.exports = {
    SingletonManager,
    getInstance
};
