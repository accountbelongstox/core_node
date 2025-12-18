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
 * Cross-Process Singleton Detector
 *
 * A universal cross-process singleton detector using port range scanning and protocol verification.
 * 1:1 port from pycore/pylauncher/singleton_detector.py
 *
 * Features:
 * - Port range scanning: Start from initial port, try sequentially until finding available port or correct instance
 * - Protocol verification: Ensure detected instance is our program, not another program
 * - PRIMARY/SECONDARY mode: First instance becomes PRIMARY, others become SECONDARY
 * - Cross-process communication: Based on JSON message protocol
 *
 * Use cases:
 * - Prevent multiple launches of the same application
 * - Cross-process instance discovery and communication
 * - Singleton service management
 *
 * Usage:
 *   const { SingletonDetector } = require('./singleton_detector');
 *
 *   const detector = new SingletonDetector({
 *     appId: 'my_app',
 *     portStart: 54000,
 *     portRange: 100
 *   });
 *
 *   const result = await detector.detectAndBind();
 *
 *   if (result.isPrimary) {
 *     console.log('Started as PRIMARY instance');
 *   } else {
 *     console.log(`Found existing instance at port ${result.existingPort}`);
 *   }
 */

const net = require('net');
const EventEmitter = require('events');
const logger = require('#@logger');

const PROTOCOL_VERSION = 'NCORE_SINGLETON_V1';

const MessageType = {
    CHECK: 'CHECK',
    ALIVE: 'ALIVE',
    SHUTDOWN: 'SHUTDOWN',
    SHUTDOWN_ACK: 'SHUTDOWN_ACK',
    STATUS: 'STATUS',
    STATUS_RESPONSE: 'STATUS_RESPONSE',
    PING: 'PING',
    PONG: 'PONG'
};

class DetectionResult {
    constructor(options = {}) {
        this.isPrimary = options.isPrimary || false;
        this.port = options.port || 0;
        this.existingInstance = options.existingInstance || false;
        this.existingPort = options.existingPort || null;
        this.message = options.message || '';
    }
}

class SingletonDetector extends EventEmitter {
    constructor(options = {}) {
        super();

        this.appId = options.appId || 'default_app';
        this.portStart = options.portStart || 54000;
        this.portRange = options.portRange || 100;
        this.timeout = options.timeout || 1000;
        this.debug = options.debug || process.env.SINGLETON_DEBUG === '1';
        this.onMessage = options.onMessage || null;
        this.stateChecker = options.stateChecker || null;
        this.shutdownExisting = options.shutdownExisting || false;

        this._isPrimary = false;
        this._boundPort = null;
        this._serverSocket = null;
        this._running = false;

        if (this.debug) {
            this._log(`Initialized for appId='${this.appId}', port range ${this.portStart}-${this.portStart + this.portRange - 1}`);
            this._log(`Protocol: ${PROTOCOL_VERSION}, Timeout: ${this.timeout}ms`);
        }
    }

    _log(message, level = 'INFO') {
        if (this.debug || ['ERROR', 'WARNING'].includes(level)) {
            const timestamp = new Date().toISOString();
            logger.info(`[${timestamp}] [${level}] SingletonDetector(${this.appId}): ${message}`);
        }
    }

    _createMessage(msgType, extraData = {}) {
        return {
            protocol: PROTOCOL_VERSION,
            type: msgType,
            appId: this.appId,
            pid: process.pid,
            timestamp: Date.now(),
            ...extraData
        };
    }

    _validateMessage(message) {
        if (typeof message !== 'object' || !message) {
            return false;
        }

        if (message.protocol !== PROTOCOL_VERSION) {
            this._log(`Protocol mismatch: ${message.protocol}`, 'WARNING');
            return false;
        }

        if (message.appId !== this.appId) {
            this._log(`App ID mismatch: ${message.appId}`, 'WARNING');
            return false;
        }

        return true;
    }

    async _sendMessageAndWaitResponse(port, message, validate = true) {
        return new Promise((resolve) => {
            const client = new net.Socket();
            const timeoutMs = message.type === MessageType.SHUTDOWN ? 2000 : this.timeout;

            let responseData = '';
            let resolved = false;

            const cleanup = () => {
                if (!resolved) {
                    resolved = true;
                    client.destroy();
                }
            };

            client.setTimeout(timeoutMs);

            client.on('connect', () => {
                const messageData = JSON.stringify(message) + '\n';
                client.write(messageData);
            });

            client.on('data', (data) => {
                responseData += data.toString();
            });

            client.on('end', () => {
                if (resolved) return;
                resolved = true;

                try {
                    const response = JSON.parse(responseData.trim());
                    if (validate && !this._validateMessage(response)) {
                        this._log(`Port ${port}: Invalid protocol`, 'WARNING');
                        resolve(null);
                        return;
                    }
                    resolve(response);
                } catch (e) {
                    this._log(`Port ${port}: JSON parse error - ${e.message}`, 'ERROR');
                    resolve(null);
                }
            });

            client.on('timeout', () => {
                cleanup();
                resolve(null);
            });

            client.on('error', (err) => {
                cleanup();
                resolve(null);
            });

            client.connect(port, 'localhost');
        });
    }

    async _tryConnectAndVerify(port) {
        this._log(`Trying to connect to port ${port}...`);
        const checkMsg = this._createMessage(MessageType.CHECK);
        const response = await this._sendMessageAndWaitResponse(port, checkMsg, true);

        if (response) {
            this._log(`Port ${port}: Found valid instance (PID ${response.pid})`);
        } else {
            this._log(`Port ${port}: Not in use or no valid response`);
        }

        return response;
    }

    async _tryBindPort(port) {
        return new Promise((resolve) => {
            this._serverSocket = net.createServer();

            this._serverSocket.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    this._log(`Port ${port}: Failed to bind - Address in use`, 'ERROR');
                } else {
                    this._log(`Port ${port}: Failed to bind - ${err.message}`, 'ERROR');
                }
                resolve(false);
            });

            this._serverSocket.on('listening', () => {
                this._boundPort = port;
                this._isPrimary = true;
                this._running = true;

                this._log(`[SUCCESS] Bound to port ${port} (PRIMARY instance)`);

                this._serverSocket.on('connection', (socket) => {
                    this._handleClient(socket);
                });

                resolve(true);
            });

            this._serverSocket.listen(port, 'localhost');
        });
    }

    async detectAndBind() {
        this._log('='.repeat(60));
        this._log(`Starting singleton detection for '${this.appId}'`);
        this._log(`Port range: ${this.portStart}-${this.portStart + this.portRange - 1}`);
        this._log(`Shutdown existing: ${this.shutdownExisting}`);
        this._log('='.repeat(60));

        for (let offset = 0; offset < this.portRange; offset++) {
            const port = this.portStart + offset;

            this._log(`[${offset + 1}/${this.portRange}] Checking port ${port}...`);

            const response = await this._tryConnectAndVerify(port);

            if (response) {
                this._log('[FOUND] Existing instance detected');

                if (this.shutdownExisting) {
                    this._log('[SHUTDOWN] Attempting to shutdown existing instance...');
                    const result = await this.sendShutdownToExisting(port);

                    if (result.accepted) {
                        this._log('[SHUTDOWN] Shutdown accepted, waiting for old instance to stop...');
                        await this._sleep(1500);

                        const maxRetries = 3;
                        for (let retry = 0; retry < maxRetries; retry++) {
                            if (retry > 0) {
                                this._log(`[RETRY] Retry ${retry}/${maxRetries} after 0.5s...`);
                                await this._sleep(500);
                            }

                            if (await this._tryBindPort(port)) {
                                this._log('[SUCCESS] Became PRIMARY instance (after shutdown)');
                                return new DetectionResult({
                                    isPrimary: true,
                                    port: port,
                                    existingInstance: false,
                                    existingPort: null,
                                    message: `Became PRIMARY instance on port ${port} (shutdown existing)`
                                });
                            }
                        }

                        this._log('[ERROR] Failed to bind port after shutdown', 'ERROR');
                        return new DetectionResult({
                            isPrimary: false,
                            port: 0,
                            existingInstance: false,
                            existingPort: null,
                            message: `Failed to bind port ${port} after shutdown (unknown error)`
                        });
                    } else {
                        const reason = result.reason;
                        this._log(`[SHUTDOWN] Shutdown rejected or no response: ${reason}`);
                        return new DetectionResult({
                            isPrimary: false,
                            port: 0,
                            existingInstance: true,
                            existingPort: port,
                            message: `Existing instance at port ${port} (${result.reason})`
                        });
                    }
                } else {
                    this._log('[FOUND] Existing instance detected (SECONDARY mode)');
                    return new DetectionResult({
                        isPrimary: false,
                        port: 0,
                        existingInstance: true,
                        existingPort: port,
                        message: `Found existing instance at port ${port}`
                    });
                }
            }

            if (await this._tryBindPort(port)) {
                this._log('[SUCCESS] Became PRIMARY instance');
                return new DetectionResult({
                    isPrimary: true,
                    port: port,
                    existingInstance: false,
                    existingPort: null,
                    message: `Became PRIMARY instance on port ${port}`
                });
            }
        }

        this._log('[FAILED] No available port in range', 'ERROR');
        return new DetectionResult({
            isPrimary: false,
            port: 0,
            existingInstance: false,
            existingPort: null,
            message: 'No available ports in range'
        });
    }

    _handleClient(socket) {
        let data = '';

        socket.on('data', (chunk) => {
            data += chunk.toString();
        });

        socket.on('end', async () => {
            try {
                const message = JSON.parse(data.trim());

                if (!this._validateMessage(message)) {
                    this._log('Invalid message received', 'WARNING');
                    return;
                }

                const msgType = message.type;
                this._log(`Received ${msgType} from PID ${message.pid}`);

                if (this.onMessage && msgType !== MessageType.SHUTDOWN) {
                    this.onMessage(message);
                }

                let response;

                if (msgType === MessageType.CHECK) {
                    response = this._createMessage(MessageType.ALIVE, {
                        isPrimary: this._isPrimary,
                        port: this._boundPort
                    });
                    socket.write(JSON.stringify(response) + '\n');

                } else if (msgType === MessageType.STATUS) {
                    let appState = {};
                    if (this.stateChecker) {
                        try {
                            appState = this.stateChecker();
                        } catch (e) {
                            this._log(`State checker failed: ${e.message}`, 'ERROR');
                            appState = { canShutdown: true, error: e.message };
                        }
                    } else {
                        appState = { canShutdown: true };
                    }

                    response = this._createMessage(MessageType.STATUS_RESPONSE, {
                        isPrimary: this._isPrimary,
                        port: this._boundPort,
                        ...appState
                    });
                    socket.write(JSON.stringify(response) + '\n');

                } else if (msgType === MessageType.SHUTDOWN) {
                    this._log('Received shutdown request', 'WARNING');

                    let canShutdown = true;
                    let shutdownReason = 'Normal shutdown';

                    if (this.stateChecker) {
                        try {
                            const appState = this.stateChecker();
                            canShutdown = appState.canShutdown !== false;
                            if (!canShutdown) {
                                shutdownReason = `Shutdown denied: ${appState.message || 'Application is busy'}`;
                                this._log(shutdownReason, 'WARNING');
                            }
                        } catch (e) {
                            this._log(`State checker failed during shutdown: ${e.message}`, 'ERROR');
                            canShutdown = true;
                        }
                    }

                    response = this._createMessage(MessageType.SHUTDOWN_ACK, {
                        accepted: canShutdown,
                        reason: canShutdown ? 'Shutdown accepted' : shutdownReason
                    });
                    socket.write(JSON.stringify(response) + '\n');
                    socket.end();

                    if (canShutdown) {
                        this._log('Shutdown ACK sent (accepted), triggering shutdown...', 'WARNING');

                        setTimeout(() => {
                            if (this.onMessage) {
                                this.onMessage({ type: 'SHUTDOWN', pid: message.pid });
                            }
                        }, 300);
                    } else {
                        this._log(`Shutdown ACK sent (rejected): ${shutdownReason}`, 'WARNING');
                    }

                } else if (msgType === MessageType.PING) {
                    response = this._createMessage(MessageType.PONG);
                    socket.write(JSON.stringify(response) + '\n');
                }

                socket.end();

            } catch (e) {
                this._log(`Error handling client: ${e.message}`, 'ERROR');
            }
        });

        socket.on('error', (err) => {
            this._log(`Socket error: ${err.message}`, 'ERROR');
        });
    }

    async sendShutdownToExisting(existingPort) {
        this._log(`Sending SHUTDOWN to existing instance on port ${existingPort}`);

        const shutdownMsg = this._createMessage(MessageType.SHUTDOWN);
        const response = await this._sendMessageAndWaitResponse(existingPort, shutdownMsg, true);

        if (response && response.type === MessageType.SHUTDOWN_ACK) {
            const accepted = response.accepted || false;
            const reason = response.reason || '';

            if (accepted) {
                this._log(`Shutdown ACCEPTED: ${reason}`);
            } else {
                this._log(`Shutdown REJECTED: ${reason}`, 'WARNING');
            }

            return { accepted, reason };
        }

        this._log('No valid shutdown response received', 'ERROR');
        return {
            accepted: false,
            reason: 'No response from existing instance'
        };
    }

    stop() {
        this._running = false;
        if (this._serverSocket) {
            this._serverSocket.close();
            this._serverSocket = null;
        }
        this._log('Detector stopped');
    }

    isPrimary() {
        return this._isPrimary;
    }

    getPort() {
        return this._boundPort;
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

async function detectSingleton(options = {}) {
    const detector = new SingletonDetector(options);
    return await detector.detectAndBind();
}

module.exports = {
    SingletonDetector,
    DetectionResult,
    MessageType,
    detectSingleton
};
