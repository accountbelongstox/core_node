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
 * Singleton RPC Entry Example
 *
 * USAGE INSTRUCTIONS:
 * ===================
 * This file demonstrates how to implement singleton RPC launcher in your application.
 *
 * DO NOT use this file directly. Instead:
 * 1. Copy SingletonRpcLauncher.js to your client project
 * 2. Copy this example file and customize for your needs
 * 3. Implement your actual backend server logic
 * 4. Implement your actual client communication logic
 * 5. Adjust configuration (port, host) for your application
 *
 * EXAMPLE INTEGRATION:
 * ====================
 * This example shows how to integrate with existing ncore/utils/rpc system
 */

const logger = require('#@logger');
const SingletonRpcLauncher = require('./SingletonRpcLauncher');
const httpRpc = require('./http_rpc');

const EXAMPLE_CONFIG = {
    HOST: 'localhost',
    PORT: 18880,
    SIGNAL_PATH: '/rpc/ping',
    CHECK_TIMEOUT: 2000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000
};

let expressServerInstance = null;
let rpcServerInstance = null;
let rpcClientInstance = null;

/**
 * Example backend server implementation
 * This function demonstrates how to start the actual RPC backend server
 *
 * CUSTOMIZE THIS FOR YOUR APPLICATION:
 * - Add your routes and handlers
 * - Initialize your database connections
 * - Setup your middleware
 * - Configure your business logic
 */
async function startExampleBackendServer(config) {
    logger.info('[Example] Starting backend server with RPC support...');

    const expressConfig = {
        port: config.PORT,
        host: config.HOST,
        staticPath: null,
        enableWs: false
    };

    expressServerInstance = await httpRpc.startExpressServer(expressConfig);

    const expressApp = httpRpc.getExpressApp();

    rpcServerInstance = httpRpc.startServer(expressApp, {
        basePath: '/rpc',
        requestTimeout: 30000,
        auth: {
            enabled: false
        },
        rateLimit: {
            enabled: false
        }
    });

    rpcServerInstance.registerRoute('echo', async (params) => {
        return {
            message: 'Echo response',
            received: params,
            timestamp: Date.now()
        };
    });

    rpcServerInstance.registerRoute('ping', async () => {
        return {
            status: 'ok',
            timestamp: Date.now()
        };
    });

    logger.info(`[Example] Backend server started on http://${config.HOST}:${config.PORT}`);
    logger.info(`[Example] RPC endpoint: http://${config.HOST}:${config.PORT}/rpc`);

    return { expressServer: expressServerInstance, rpcServer: rpcServerInstance };
}

/**
 * Example client communication implementation
 * This function demonstrates how to create and use RPC client
 *
 * CUSTOMIZE THIS FOR YOUR APPLICATION:
 * - Implement your client-side business logic
 * - Add error handling and retry logic
 * - Setup event listeners
 * - Handle connection lifecycle
 */
async function startExampleClientCommunication(config) {
    logger.info('[Example] Starting client communication...');

    const baseUrl = `http://${config.HOST}:${config.PORT}/rpc`;

    rpcClientInstance = httpRpc.createClient(baseUrl, {
        timeout: 5000,
        retries: 3,
        retryDelay: 1000
    });

    try {
        const pingResult = await rpcClientInstance.call('ping', {});
        logger.info('[Example] Client successfully connected to backend:', pingResult);

        const echoResult = await rpcClientInstance.call('echo', {
            message: 'Hello from client',
            clientId: process.pid
        });
        logger.info('[Example] Echo test successful:', echoResult);

    } catch (error) {
        logger.error('[Example] Client communication error:', error);
        throw error;
    }

    return rpcClientInstance;
}

/**
 * Extended Singleton RPC Launcher with actual implementation
 */
class ExampleSingletonRpcLauncher extends SingletonRpcLauncher {
    async startBackendServer() {
        if (this.backendServerRunning) {
            logger.warn('[Example] Backend server already running');
            return;
        }

        logger.info('[Example] Starting backend server thread...');

        try {
            const portAvailable = await this.isPortAvailable(this.config.PORT);

            if (!portAvailable) {
                logger.error(`[Example] Port ${this.config.PORT} is already in use`);
                throw new Error(`Port ${this.config.PORT} is already in use`);
            }

            await startExampleBackendServer(this.config);

            this.backendServerRunning = true;
            this.emit('backendStarted', {
                host: this.config.HOST,
                port: this.config.PORT
            });

            logger.info('[Example] Backend server thread started successfully');

        } catch (error) {
            logger.error('[Example] Failed to start backend server:', error);
            this.backendServerRunning = false;
            this.emit('backendError', error);
            throw error;
        }
    }

    async startClientCommunication() {
        if (this.clientConnected) {
            logger.warn('[Example] Client already connected');
            return;
        }

        logger.info('[Example] Starting client communication thread...');

        try {
            await startExampleClientCommunication(this.config);

            this.clientConnected = true;
            this.emit('clientConnected', {
                host: this.config.HOST,
                port: this.config.PORT
            });

            logger.info('[Example] Client communication thread started successfully');

        } catch (error) {
            logger.error('[Example] Failed to start client communication:', error);
            this.clientConnected = false;
            this.emit('clientError', error);
            throw error;
        }
    }

    async stopBackendServer() {
        if (!this.backendServerRunning) {
            return;
        }

        logger.info('[Example] Stopping backend server...');

        try {
            if (rpcServerInstance) {
                httpRpc.stopServer();
                rpcServerInstance = null;
            }

            if (expressServerInstance) {
                httpRpc.stopExpressServer();
                expressServerInstance = null;
            }

            this.backendServerRunning = false;
            this.emit('backendStopped');
            logger.info('[Example] Backend server stopped');

        } catch (error) {
            logger.error('[Example] Error stopping backend server:', error);
            this.emit('backendStopError', error);
        }
    }

    async disconnectClient() {
        if (!this.clientConnected) {
            return;
        }

        logger.info('[Example] Disconnecting client...');

        try {
            rpcClientInstance = null;
            this.clientConnected = false;
            this.emit('clientDisconnected');
            logger.info('[Example] Client disconnected');

        } catch (error) {
            logger.error('[Example] Error disconnecting client:', error);
            this.emit('clientDisconnectError', error);
        }
    }
}

/**
 * Example main entry function
 * This demonstrates how to use the singleton launcher in your application
 */
async function main() {
    logger.info('='.repeat(60));
    logger.info('Singleton RPC Entry Example');
    logger.info('='.repeat(60));

    const launcher = new ExampleSingletonRpcLauncher(EXAMPLE_CONFIG);

    launcher.on('launched', (info) => {
        logger.info('[Example] System launched successfully:', info);
    });

    launcher.on('backendStarted', (info) => {
        logger.info('[Example] Backend server is running:', info);
    });

    launcher.on('clientConnected', (info) => {
        logger.info('[Example] Client is connected:', info);
    });

    launcher.on('launchError', (error) => {
        logger.error('[Example] Launch error:', error);
    });

    try {
        await launcher.launch();

        logger.info('[Example] Launch complete. Status:', launcher.getStatus());

        process.on('SIGINT', async () => {
            logger.info('\n[Example] Received SIGINT, shutting down...');
            await launcher.shutdown();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            logger.info('\n[Example] Received SIGTERM, shutting down...');
            await launcher.shutdown();
            process.exit(0);
        });

    } catch (error) {
        logger.error('[Example] Failed to launch:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(error => {
        logger.error('[Example] Fatal error:', error);
        process.exit(1);
    });
}

module.exports = {
    ExampleSingletonRpcLauncher,
    startExampleBackendServer,
    startExampleClientCommunication,
    EXAMPLE_CONFIG
};
