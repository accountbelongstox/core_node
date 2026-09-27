/**
 * Express Application Factory
 *
 * Creates and configures Express application for Ncore Module Caller.
 */

const express = require('express');
const path = require('path');
const serviceContract = require('#@/config/service_contract.js');
const localRpcGuard = require('#@foundation/common/local_rpc_guard.js');

const { getGlobalConfig } = require('./global_config');
const { ncoreController } = require('../ncontroller/controller');
const ncontrollerRoutes = require('../ncontroller/routes');

const BODY_LIMIT = '50mb';
const GUARD_OPTIONS = { credentials: true };

let app = null;
let browserStarted = false;

/**
 * Create and configure Express application
 * @returns {Promise<express.Application>}
 */
async function createApp() {
    const config = getGlobalConfig();

    app = express();

    // Middleware
    app.use(localRpcGuard.createExpressGuard(GUARD_OPTIONS));
    app.use(express.json({ limit: BODY_LIMIT, verify: localRpcGuard.captureRawBody }));
    app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT, verify: localRpcGuard.captureRawBody }));
    app.use(localRpcGuard.createExpressBodyDigestCheck());

    // Root endpoint - API documentation (JSON format)
    app.get('/', (req, res) => {
        const baseUrl = `${req.protocol}://${req.get('host')}`;

        res.json({
            service: 'ncore-module-caller',
            version: '1.0.0',
            description: 'Dynamic Node.js Module Calling Service with Express & Browser Control',
            server: {
                host: config.host,
                port: config.httpPort,
                localIp: config.localIp || 'N/A',
                networkIps: config.networkIps || []
            },
            endpoints: {
                service_information: {
                    health_check: {
                        method: 'GET',
                        url: `${baseUrl}/health`,
                        description: 'Service health status'
                    },
                    api_info: {
                        method: 'GET',
                        url: `${baseUrl}/api/info`,
                        description: 'API information'
                    },
                    service_status: {
                        method: 'GET',
                        url: `${baseUrl}/api/status`,
                        description: 'Service configuration status'
                    }
                },
                module_calling: {
                    call_module: {
                        method: 'POST',
                        url: `${baseUrl}/api/call`,
                        description: 'Call a Node.js module function',
                        body: {
                            module: 'path/to/module',
                            function: 'functionName',
                            args: []
                        }
                    },
                    call_history: {
                        method: 'GET',
                        url: `${baseUrl}/api/history`,
                        description: 'Get module call history',
                        query: {
                            limit: 50
                        }
                    },
                    clear_history: {
                        method: 'POST',
                        url: `${baseUrl}/api/history/clear`,
                        description: 'Clear call history'
                    }
                },
                rpc_endpoints: {
                    rpc_base: {
                        method: 'POST',
                        url: `${baseUrl}/rpc`,
                        description: 'RPC base endpoint'
                    },
                    rpc_route: {
                        method: 'POST',
                        url: `${baseUrl}/rpc/:route`,
                        description: 'RPC dynamic route endpoint'
                    }
                },
                browser_controller: {
                    browser_status: {
                        method: 'GET',
                        url: `${baseUrl}/api/browser/status`,
                        description: 'Get browser manager status'
                    },
                    controller_status: {
                        method: 'GET',
                        url: `${baseUrl}/api/controller/status`,
                        description: 'Get ncore controller status'
                    }
                }
            },
            timestamp: new Date().toISOString()
        });
    });

    // Health check endpoint
    app.get('/health', (req, res) => {
        res.json({
            status: 'healthy',
            service: 'ncore-module-caller',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            config: config.getStatus()
        });
    });

    // API info endpoint
    app.get('/api/info', (req, res) => {
        res.json({
            service: 'Ncore Module Caller',
            version: '1.0.0',
            endpoints: {
                health: 'GET /health',
                info: 'GET /api/info',
                call: 'POST /api/call',
                status: 'GET /api/status'
            }
        });
    });

    // Status endpoint
    app.get('/api/status', (req, res) => {
        res.json(config.getStatus());
    });

    // Module call endpoint
    app.post('/api/call', async (req, res) => {
        const { module: modulePath, function: functionName, args = [] } = req.body;

        if (!config.apiEnabled) {
            return res.status(403).json({
                success: false,
                error: 'API access is disabled'
            });
        }

        if (!modulePath) {
            return res.status(400).json({
                success: false,
                error: 'Module path is required'
            });
        }

        // Only explicit module/function pairs from the allow-list may be called
        const { allowed, reason, modulePath: allowedModulePath } = config.isCallAllowed(modulePath, functionName);
        if (!allowed) {
            config.addCallHistory(String(modulePath), String(functionName || ''), false, reason);
            return res.status(403).json({
                success: false,
                code: reason,
                error: reason
            });
        }

        try {
            const targetModule = require(path.join(config.ncoreRoot, allowedModulePath));

            if (typeof targetModule[functionName] !== 'function') {
                const errorMsg = `Function '${functionName}' not found in module`;
                config.addCallHistory(allowedModulePath, functionName, false, errorMsg);
                return res.status(404).json({
                    success: false,
                    error: errorMsg
                });
            }

            const result = await targetModule[functionName](...(Array.isArray(args) ? args : []));

            config.addCallHistory(allowedModulePath, functionName, true);

            res.json({
                success: true,
                result: result
            });
        } catch (error) {
            const errorMsg = error.message || String(error);
            config.addCallHistory(allowedModulePath, functionName, false, errorMsg);

            res.status(500).json({
                success: false,
                error: errorMsg,
                stack: config.debugMode ? error.stack : undefined
            });
        }
    });

    // Call history endpoint
    app.get('/api/history', (req, res) => {
        const limit = parseInt(req.query.limit) || 50;
        const history = config.callHistory.slice(-limit);
        res.json({
            total: config.callHistory.length,
            items: history
        });
    });

    // Clear history endpoint
    app.post('/api/history/clear', (req, res) => {
        config.callHistory = [];
        res.json({
            success: true,
            message: 'Call history cleared'
        });
    });

    // JSON-RPC 2.0 endpoint
    app.post('/rpc', async (req, res) => {
        const request = req.body;
        const requestId = request.id || null;
        const method = request.method;
        const params = request.params || {};

        if (!method) {
            return res.json({
                jsonrpc: '2.0',
                error: {
                    code: -32600,
                    message: 'Invalid Request: method is required'
                },
                id: requestId
            });
        }

        // Find route handler
        let handler = null;
        for (const routeGroup of Object.values(ncontrollerRoutes)) {
            if (routeGroup[method]) {
                handler = routeGroup[method];
                break;
            }
        }

        if (!handler) {
            return res.json({
                jsonrpc: '2.0',
                error: {
                    code: -32601,
                    message: `Method not found: ${method}`
                },
                id: requestId
            });
        }

        try {
            const result = await handler(params);
            res.json({
                jsonrpc: '2.0',
                result: result,
                id: requestId
            });
        } catch (error) {
            res.json({
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: error.message
                },
                id: requestId
            });
        }
    });

    // RPC endpoint for ncontroller routes (supports paths like /rpc/browser/openUrl)
    app.post('/rpc/*', async (req, res) => {
        const fullPath = req.params[0];
        const params = req.body;

        // Find route handler
        let handler = null;
        for (const routeGroup of Object.values(ncontrollerRoutes)) {
            if (routeGroup[fullPath]) {
                handler = routeGroup[fullPath];
                break;
            }
        }

        if (!handler) {
            return res.status(404).json({
                success: false,
                error: `Route '${fullPath}' not found`
            });
        }

        try {
            const result = await handler(params);
            res.json({
                success: true,
                result: result
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Browser status endpoint
    app.get('/api/browser/status', (req, res) => {
        res.json(ncoreController.browserManager.getStatus());
    });

    // Controller status endpoint
    app.get('/api/controller/status', (req, res) => {
        res.json(ncoreController.getStatus());
    });

    // Singleton manager endpoints
    const { getInstance: getSingletonManager } = require('./platform/singleton_manager');
    const singletonManager = getSingletonManager();

    // ThreadBus endpoints
    const { getThreadBus } = require('#@thread_bus');
    const threadBus = getThreadBus();

    // Get ThreadBus status
    app.get('/api/threadbus/status', (req, res) => {
        res.json(threadBus.getStatus());
    });

    // Register the main Express server with ThreadBus
    threadBus.register('express-server', {
        priority: 100,
        onShutdown: async () => {
            console.log('[Express] Shutting down server...');
        }
    });

    // Get singleton status
    app.get('/api/singleton/status', (req, res) => {
        res.json(singletonManager.getStatus());
    });

    // Request shutdown (for singleton takeover)
    app.post('/api/singleton/shutdown', async (req, res) => {
        const { reason } = req.body || {};
        const shutdownCheck = singletonManager.canShutdown();

        if (!shutdownCheck.canShutdown) {
            return res.json({
                success: false,
                busy: true,
                reason: shutdownCheck.reason
            });
        }

        res.json({
            success: true,
            message: 'Shutdown initiated'
        });

        // Execute shutdown after response
        setTimeout(() => {
            singletonManager.executeShutdown(reason || 'Singleton takeover');
        }, 100);
    });

    // Start ncontroller with browser
    if (!browserStarted) {
        const autoLaunchBrowser = config.autoLaunchBrowser !== false;

        if (autoLaunchBrowser) {
            console.log('[App] Starting ncontroller with browser...');
            ncoreController.start({
                autoLaunchBrowser: true,
                browserType: config.browserType || 'edge'
            }).then(() => {
                browserStarted = true;
                console.log('[App] Browser launched successfully');
            }).catch((error) => {
                console.log('[App] Failed to launch browser:', error.message);
            });
        }
    }

    // Start MCP Chrome Server
    const { startMCPChromeServer } = require('#@ncore/utils/jsmcptools/index.js');
    startMCPChromeServer({
        port: serviceContract.port('mcp_chrome'),
        host: serviceContract.host('loopback')
    }).then(() => {
        console.log('[App] MCP Chrome Server started successfully');
    }).catch((error) => {
        console.log('[App] Failed to start MCP Chrome Server:', error.message);
    });

    // Startup event
    config.serverRunning = true;
    config.updateNetworkInfo();

    // Get all network interfaces
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    const availableIPs = [];

    for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        for (const iface of interfaces) {
            if (iface.family === 'IPv4' && !iface.internal) {
                availableIPs.push(iface.address);
            }
        }
    }

    console.log('='.repeat(60));
    console.log('Ncore Module Caller Express Server Started');
    console.log('='.repeat(60));
    console.log(`Health check:     http://${config.host}:${config.httpPort}/health`);
    console.log(`API info:         http://${config.host}:${config.httpPort}/api/info`);
    console.log(`API endpoint:     POST http://${config.host}:${config.httpPort}/api/call`);
    console.log(`RPC endpoint:     POST http://${config.host}:${config.httpPort}/rpc/{route}`);
    console.log(`Browser status:   http://${config.host}:${config.httpPort}/api/browser/status`);
    console.log(`Controller status: http://${config.host}:${config.httpPort}/api/controller/status`);

    if (availableIPs.length > 0) {
        console.log('='.repeat(60));
        console.log('Available on:');
        availableIPs.forEach(ip => {
            console.log(`  - http://${ip}:${config.httpPort}`);
        });
        console.log(`  - http://localhost:${config.httpPort}`);
    }

    console.log('='.repeat(60));

    return app;
}

/**
 * Get the Express application instance
 * @returns {express.Application|null}
 */
function getApp() {
    return app;
}

module.exports = {
    createApp,
    getApp
};
