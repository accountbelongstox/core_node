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
 * Singleton RPC Launcher Example
 *
 * IMPORTANT NOTES:
 * - This is an EXAMPLE implementation for reference only
 * - DO NOT import this file directly in your application
 * - Instead, COPY this implementation to your own client application
 * - Customize the configuration (port, host, etc.) for your specific needs
 *
 * PURPOSE:
 * This launcher ensures only one RPC backend server runs at a time.
 * Multiple clients can connect to the same backend server instance,
 * reducing resource usage and startup time.
 *
 * HOW IT WORKS:
 * 1. Client attempts to connect to configured RPC server (hardcoded port/host)
 * 2. If connection successful -> Server already running, use existing backend
 * 3. If connection fails -> No server running, start new backend server
 * 4. Backend server listens on configured port for client connections
 *
 * USAGE PATTERN:
 * Copy this file to your client project and implement similar logic:
 * - Adjust HARDCODED_CONFIG for your application
 * - Implement your backend server logic in startBackendServer()
 * - Implement your client communication in startClientCommunication()
 */

const http = require('http');
const net = require('net');
const { EventEmitter } = require('events');
const logger = require('#@logger');

const HARDCODED_CONFIG = {
    HOST: 'localhost',
    PORT: 18880,
    SIGNAL_PATH: '/rpc/ping',
    CHECK_TIMEOUT: 2000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000
};

class SingletonRpcLauncher extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            ...HARDCODED_CONFIG,
            ...config
        };

        this.backendServerRunning = false;
        this.clientConnected = false;
        this.backendServer = null;
        this.clientThread = null;
        this.backendThread = null;
    }

    /**
     * Check if RPC server is already running
     * Sends a signal to the hardcoded port to detect existing instance
     */
    async checkServerRunning() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = this.config.RETRY_ATTEMPTS;

            const tryConnect = () => {
                attempts++;

                const options = {
                    hostname: this.config.HOST,
                    port: this.config.PORT,
                    path: this.config.SIGNAL_PATH,
                    method: 'GET',
                    timeout: this.config.CHECK_TIMEOUT
                };

                const req = http.request(options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => data += chunk);
                    res.on('end', () => {
                        if (res.statusCode === 200) {
                            logger.info('[SingletonRPC] Detected running server instance');
                            resolve(true);
                        } else if (attempts < maxAttempts) {
                            setTimeout(tryConnect, this.config.RETRY_DELAY);
                        } else {
                            resolve(false);
                        }
                    });
                });

                req.on('error', (err) => {
                    if (attempts < maxAttempts) {
                        setTimeout(tryConnect, this.config.RETRY_DELAY);
                    } else {
                        logger.info('[SingletonRPC] No existing server detected, will start new instance');
                        resolve(false);
                    }
                });

                req.on('timeout', () => {
                    req.destroy();
                    if (attempts < maxAttempts) {
                        setTimeout(tryConnect, this.config.RETRY_DELAY);
                    } else {
                        resolve(false);
                    }
                });

                req.end();
            };

            tryConnect();
        });
    }

    /**
     * Check if port is available
     */
    async isPortAvailable(port) {
        return new Promise((resolve) => {
            const server = net.createServer();

            server.once('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    resolve(false);
                } else {
                    resolve(true);
                }
            });

            server.once('listening', () => {
                server.close();
                resolve(true);
            });

            server.listen(port, this.config.HOST);
        });
    }

    /**
     * Start backend server thread
     * This runs the main RPC server that handles requests
     *
     * IMPLEMENTATION NOTE:
     * In your actual application, replace this with your backend server logic
     * Example: Initialize your Express app, RPC server, database connections, etc.
     */
    async startBackendServer() {
        if (this.backendServerRunning) {
            logger.warn('[SingletonRPC] Backend server already running');
            return;
        }

        logger.info('[SingletonRPC] Starting backend server thread...');

        try {
            const portAvailable = await this.isPortAvailable(this.config.PORT);

            if (!portAvailable) {
                logger.error(`[SingletonRPC] Port ${this.config.PORT} is already in use`);
                throw new Error(`Port ${this.config.PORT} is already in use`);
            }

            this.backendServerRunning = true;

            this.emit('backendStarting');

            logger.info(`[SingletonRPC] Backend server started on ${this.config.HOST}:${this.config.PORT}`);
            this.emit('backendStarted', {
                host: this.config.HOST,
                port: this.config.PORT
            });

        } catch (error) {
            logger.error('[SingletonRPC] Failed to start backend server:', error);
            this.backendServerRunning = false;
            this.emit('backendError', error);
            throw error;
        }
    }

    /**
     * Start client communication thread
     * This handles communication with the backend server
     *
     * IMPLEMENTATION NOTE:
     * In your actual application, replace this with your client logic
     * Example: Create RPC client, establish connection, handle requests, etc.
     */
    async startClientCommunication() {
        if (this.clientConnected) {
            logger.warn('[SingletonRPC] Client already connected');
            return;
        }

        logger.info('[SingletonRPC] Starting client communication thread...');

        try {
            this.clientConnected = true;

            this.emit('clientConnecting');

            logger.info(`[SingletonRPC] Client connected to ${this.config.HOST}:${this.config.PORT}`);
            this.emit('clientConnected', {
                host: this.config.HOST,
                port: this.config.PORT
            });

        } catch (error) {
            logger.error('[SingletonRPC] Failed to start client communication:', error);
            this.clientConnected = false;
            this.emit('clientError', error);
            throw error;
        }
    }

    /**
     * Main launch method
     * Orchestrates the singleton startup logic:
     * 1. Check if server already running
     * 2. If yes -> Start only client communication
     * 3. If no -> Start backend server + client communication
     */
    async launch() {
        logger.info('[SingletonRPC] Launching singleton RPC system...');

        try {
            const serverRunning = await this.checkServerRunning();

            if (serverRunning) {
                logger.info('[SingletonRPC] Server detected, starting client-only mode');
                await this.startClientCommunication();
            } else {
                logger.info('[SingletonRPC] No server detected, starting full mode (backend + client)');
                await this.startBackendServer();
                await this.startClientCommunication();
            }

            this.emit('launched', {
                mode: serverRunning ? 'client-only' : 'full',
                backendRunning: this.backendServerRunning,
                clientConnected: this.clientConnected
            });

            logger.info('[SingletonRPC] Launch complete');

        } catch (error) {
            logger.error('[SingletonRPC] Launch failed:', error);
            this.emit('launchError', error);
            throw error;
        }
    }

    /**
     * Stop backend server
     */
    async stopBackendServer() {
        if (!this.backendServerRunning) {
            return;
        }

        logger.info('[SingletonRPC] Stopping backend server...');

        try {
            this.backendServerRunning = false;

            if (this.backendServer) {
                this.backendServer = null;
            }

            this.emit('backendStopped');
            logger.info('[SingletonRPC] Backend server stopped');

        } catch (error) {
            logger.error('[SingletonRPC] Error stopping backend server:', error);
            this.emit('backendStopError', error);
        }
    }

    /**
     * Disconnect client
     */
    async disconnectClient() {
        if (!this.clientConnected) {
            return;
        }

        logger.info('[SingletonRPC] Disconnecting client...');

        try {
            this.clientConnected = false;

            this.emit('clientDisconnected');
            logger.info('[SingletonRPC] Client disconnected');

        } catch (error) {
            logger.error('[SingletonRPC] Error disconnecting client:', error);
            this.emit('clientDisconnectError', error);
        }
    }

    /**
     * Shutdown entire system
     */
    async shutdown() {
        logger.info('[SingletonRPC] Shutting down...');

        await this.disconnectClient();
        await this.stopBackendServer();

        this.emit('shutdown');
        logger.info('[SingletonRPC] Shutdown complete');
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            backendServerRunning: this.backendServerRunning,
            clientConnected: this.clientConnected,
            config: this.config
        };
    }
}

module.exports = SingletonRpcLauncher;
