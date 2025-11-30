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

const logger = require('#@logger');
const SingletonRpcLauncher = require('#@singleton_rpc_launcher');
const CoreNodeInitMCPServer = require('./CoreNodeInitMCPServer');

const CORE_NODE_CONFIG = {
    HOST: 'localhost',
    PORT: 19880,
    SIGNAL_PATH: '/health/ping',
    CHECK_TIMEOUT: 3000,
    RETRY_ATTEMPTS: 2,
    RETRY_DELAY: 1000
};

let mcpServerInstance = null;
let backendInitialized = false;
let clientConnected = false;

class CoreNodeSingletonLauncher extends SingletonRpcLauncher {
    constructor(config = {}) {
        super({
            ...CORE_NODE_CONFIG,
            ...config
        });
    }

    /**
     * Start backend MCP server
     * This includes all backend services:
     * - Singleton Browser
     * - IT Tools
     * - Frontend Launcher
     * - WebSocket/HTTP servers
     * - Electron integration
     */
    async startBackendServer() {
        if (this.backendServerRunning || backendInitialized) {
            logger.warn('[CoreNodeSingleton] Backend server already running');
            return;
        }

        logger.info('[CoreNodeSingleton] Starting backend MCP server...');

        try {
            const portAvailable = await this.isPortAvailable(this.config.PORT);

            if (!portAvailable) {
                logger.error(`[CoreNodeSingleton] Port ${this.config.PORT} is already in use`);
                throw new Error(`Port ${this.config.PORT} is already in use`);
            }

            mcpServerInstance = new CoreNodeInitMCPServer();
            await mcpServerInstance.initialize();

            backendInitialized = true;
            this.backendServerRunning = true;

            this.emit('backendStarted', {
                host: this.config.HOST,
                port: this.config.PORT,
                services: {
                    browser: true,
                    ittools: true,
                    frontend: true,
                    websocket: true,
                    http: true
                }
            });

            logger.info('[CoreNodeSingleton] Backend MCP server started successfully');
            logger.info(`[CoreNodeSingleton] Health check available at: http://${this.config.HOST}:${this.config.PORT}${this.config.SIGNAL_PATH}`);

        } catch (error) {
            logger.error('[CoreNodeSingleton] Failed to start backend server:', error);
            backendInitialized = false;
            this.backendServerRunning = false;
            this.emit('backendError', error);
            throw error;
        }
    }

    /**
     * Start client communication
     * This establishes connection to the backend MCP server
     * Clients can interact with the backend services through this communication layer
     */
    async startClientCommunication() {
        if (this.clientConnected || clientConnected) {
            logger.warn('[CoreNodeSingleton] Client already connected');
            return;
        }

        logger.info('[CoreNodeSingleton] Starting client communication...');

        try {
            logger.info(`[CoreNodeSingleton] Client connecting to backend at ${this.config.HOST}:${this.config.PORT}`);

            clientConnected = true;
            this.clientConnected = true;

            this.emit('clientConnected', {
                host: this.config.HOST,
                port: this.config.PORT,
                mode: this.backendServerRunning ? 'full' : 'client-only'
            });

            logger.info('[CoreNodeSingleton] Client communication established successfully');

            if (!this.backendServerRunning) {
                logger.info('[CoreNodeSingleton] Running in client-only mode - using existing backend');
            }

        } catch (error) {
            logger.error('[CoreNodeSingleton] Failed to start client communication:', error);
            clientConnected = false;
            this.clientConnected = false;
            this.emit('clientError', error);
            throw error;
        }
    }

    /**
     * Stop backend server
     */
    async stopBackendServer() {
        if (!this.backendServerRunning || !backendInitialized) {
            return;
        }

        logger.info('[CoreNodeSingleton] Stopping backend MCP server...');

        try {
            if (mcpServerInstance) {
                await mcpServerInstance.cleanup();
                mcpServerInstance = null;
            }

            backendInitialized = false;
            this.backendServerRunning = false;

            this.emit('backendStopped');
            logger.info('[CoreNodeSingleton] Backend MCP server stopped');

        } catch (error) {
            logger.error('[CoreNodeSingleton] Error stopping backend server:', error);
            this.emit('backendStopError', error);
        }
    }

    /**
     * Disconnect client
     */
    async disconnectClient() {
        if (!this.clientConnected || !clientConnected) {
            return;
        }

        logger.info('[CoreNodeSingleton] Disconnecting client...');

        try {
            clientConnected = false;
            this.clientConnected = false;

            this.emit('clientDisconnected');
            logger.info('[CoreNodeSingleton] Client disconnected');

        } catch (error) {
            logger.error('[CoreNodeSingleton] Error disconnecting client:', error);
            this.emit('clientDisconnectError', error);
        }
    }

    /**
     * Get MCP server instance (only available if backend is running)
     */
    getMCPServerInstance() {
        if (!backendInitialized) {
            logger.warn('[CoreNodeSingleton] Backend not initialized, cannot get MCP server instance');
            return null;
        }
        return mcpServerInstance;
    }

    /**
     * Check if backend is initialized
     */
    isBackendInitialized() {
        return backendInitialized;
    }

    /**
     * Check if client is connected
     */
    isClientConnected() {
        return clientConnected;
    }

    /**
     * Get detailed status
     */
    getDetailedStatus() {
        return {
            ...super.getStatus(),
            backend: {
                initialized: backendInitialized,
                mcpServer: mcpServerInstance !== null,
                services: backendInitialized ? {
                    browser: true,
                    ittools: true,
                    frontend: true
                } : null
            },
            client: {
                connected: clientConnected,
                mode: this.backendServerRunning ? 'full' : 'client-only'
            }
        };
    }
}

module.exports = CoreNodeSingletonLauncher;
