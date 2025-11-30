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

'use strict';

/**
 * Tampermonkey RPC SubApp Integration
 *
 * Registers tampermonkey functionality as an RPC SubApp
 * TampermonkeyServer runs independently on port 8765
 * This provides RPC access to tampermonkey features
 */

const logger = require('#@logger');
const TampermonkeyServer = require('#@ncore/utils/puppeteer_spider_v2/src/utils/tampermonkey/TampermonkeyServer.js');

let tampermonkeyServerInstance = null;

/**
 * Get or create TampermonkeyServer instance
 */
function getTampermonkeyServer() {
    if (!tampermonkeyServerInstance) {
        tampermonkeyServerInstance = TampermonkeyServer.getInstance({
            port: 8765,
            host: '127.0.0.1',
            wsPath: '/ws',
            autoStart: true
        });
    }
    return tampermonkeyServerInstance;
}

/**
 * Register Tampermonkey SubApp routes
 */
function registerTampermonkeySubApp(rpc) {
    logger.info('[Tampermonkey-SubApp] Registering Tampermonkey SubApp');

    // Register SubApp
    rpc.registerSubApp('tampermonkey', {
        config: {
            TAMPERMONKEY_PORT: 8765,
            TAMPERMONKEY_HOST: '127.0.0.1'
        }
    });

    // Route: Get status
    rpc.registerRoute('tampermonkey', 'status', async (params, context) => {
        try {
            const server = getTampermonkeyServer();
            const statistics = server.getStatistics();
            return {
                success: true,
                status: server.isRunning ? 'running' : 'stopped',
                port: server.port,
                host: server.host,
                statistics: statistics
            };
        } catch (error) {
            logger.error('[Tampermonkey-SubApp] Failed to get status:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Route: Get received pages
    rpc.registerRoute('tampermonkey', 'pages', async (params, context) => {
        try {
            const server = getTampermonkeyServer();
            const pages = server.getReceivedPages();
            return {
                success: true,
                count: pages.length,
                pages: pages
            };
        } catch (error) {
            logger.error('[Tampermonkey-SubApp] Failed to get pages:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Route: Clear received pages
    rpc.registerRoute('tampermonkey', 'clear', async (params, context) => {
        try {
            const server = getTampermonkeyServer();
            server.clearReceivedPages();
            return {
                success: true,
                message: 'Received pages cleared'
            };
        } catch (error) {
            logger.error('[Tampermonkey-SubApp] Failed to clear pages:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Route: Send command to connected clients
    rpc.registerRoute('tampermonkey', 'command', async (params, context) => {
        try {
            const { action, payload } = params;
            if (!action) {
                return {
                    success: false,
                    error: 'Action is required'
                };
            }

            const server = getTampermonkeyServer();
            server.sendCommand(action, payload || {});

            return {
                success: true,
                message: `Command '${action}' sent to all connected clients`
            };
        } catch (error) {
            logger.error('[Tampermonkey-SubApp] Failed to send command:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Route: Broadcast config to connected clients
    rpc.registerRoute('tampermonkey', 'config', async (params, context) => {
        try {
            const server = getTampermonkeyServer();
            server.broadcastConfig(params);

            return {
                success: true,
                message: 'Config broadcasted to all connected clients'
            };
        } catch (error) {
            logger.error('[Tampermonkey-SubApp] Failed to broadcast config:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Route: Start tampermonkey server
    rpc.registerRoute('tampermonkey', 'start', async (params, context) => {
        try {
            const server = getTampermonkeyServer();
            if (server.isRunning) {
                return {
                    success: true,
                    message: 'Tampermonkey server is already running',
                    port: server.port
                };
            }

            await server.start();

            return {
                success: true,
                message: 'Tampermonkey server started',
                port: server.port,
                host: server.host
            };
        } catch (error) {
            logger.error('[Tampermonkey-SubApp] Failed to start server:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Route: Stop tampermonkey server
    rpc.registerRoute('tampermonkey', 'stop', async (params, context) => {
        try {
            const server = getTampermonkeyServer();
            if (!server.isRunning) {
                return {
                    success: true,
                    message: 'Tampermonkey server is not running'
                };
            }

            await server.stop();

            return {
                success: true,
                message: 'Tampermonkey server stopped'
            };
        } catch (error) {
            logger.error('[Tampermonkey-SubApp] Failed to stop server:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    logger.info('[Tampermonkey-SubApp] Tampermonkey SubApp registered successfully');
}

module.exports = {
    registerTampermonkeySubApp,
    getTampermonkeyServer
};
