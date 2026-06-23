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
 * Express Application Factory
 *
 * Creates and configures Express application for Ncore Module Caller.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const { getGlobalConfig } = require('./global_config');
const { ncoreController } = require('../ncontroller/controller');
const ncontrollerRoutes = require('../ncontroller/routes');

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
    app.use(cors({
        origin: '*',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }));

    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

        // Check module permissions
        const { allowed, reason } = config.isModuleAllowed(modulePath);
        if (!allowed) {
            config.addCallHistory(modulePath, functionName, false, reason);
            return res.status(403).json({
                success: false,
                error: reason
            });
        }

        try {
            // Resolve module path
            let resolvedPath = modulePath;
            if (!path.isAbsolute(modulePath)) {
                resolvedPath = path.join(config.ncoreRoot, modulePath);
            }

            // Load module
            const targetModule = require(resolvedPath);

            let result;
            if (functionName) {
                // Call specific function
                if (typeof targetModule[functionName] !== 'function') {
                    const errorMsg = `Function '${functionName}' not found in module`;
                    config.addCallHistory(modulePath, functionName, false, errorMsg);
                    return res.status(404).json({
                        success: false,
                        error: errorMsg
                    });
                }

                result = await targetModule[functionName](...args);
            } else {
                // Call module directly if it's a function
                if (typeof targetModule === 'function') {
                    result = await targetModule(...args);
                } else {
                    result = targetModule;
                }
            }

            config.addCallHistory(modulePath, functionName || 'default', true);

            res.json({
                success: true,
                result: result
            });
        } catch (error) {
            const errorMsg = error.message || String(error);
            config.addCallHistory(modulePath, functionName || 'default', false, errorMsg);

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
    const { startMCPChromeServer } = require('#@ncore/utils/jsmcptools');
    startMCPChromeServer({
        port: 12306,
        host: '127.0.0.1'
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
