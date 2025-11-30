// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const logger = require('#@logger');
const { EnhancedItTools } = require('#@ittools');
const httpUtils = require('../../../ncore/utils/http-wrapper');
const wsRpcUtils = require('../../../ncore/utils/rpc/ws_rpc');

class ITToolsIntegrationController {
    constructor() {
        this.name = 'ITToolsIntegrationController';
        this.version = '1.0.0';
        this.itToolsInstance = null;
        this.httpServer = null;
        this.wsRpcServer = null;
        this.subAppRoutes = new Map();
        this.subAppControllers = new Map();
        this.initialized = false;
        this.config = {
            httpPort: 8080,
            wsPort: 8081,
            host: 'localhost',
            enableCors: true,
            enableWebSocket: true,
            enableHttp: true,
            staticDir: null
        };
    }

    async initialize(config = {}) {
        if (this.initialized) {
            logger.warn('ITToolsIntegrationController already initialized');
            return this;
        }

        try {
            logger.info('Initializing ITToolsIntegrationController...');

            // Merge configuration
            this.config = { ...this.config, ...config };

            // Initialize enhanced ittools
            this.itToolsInstance = new EnhancedItTools();
            await this.itToolsInstance.initialize({
                port: this.config.httpPort,
                host: this.config.host,
                enableWs: this.config.enableWebSocket,
                staticDir: this.config.staticDir,
                cors: this.config.enableCors
            });

            // Setup route interfaces
            this.setupRouteInterfaces();

            this.initialized = true;
            logger.info('ITToolsIntegrationController initialized successfully');
            return this;
        } catch (error) {
            logger.error(`Failed to initialize ITToolsIntegrationController: ${error.message}`);
            throw error;
        }
    }

    setupRouteInterfaces() {
        if (!this.itToolsInstance) {
            return;
        }

        // Get route interface from ittools
        const routeInterface = this.itToolsInstance.createRouteInterface();

        // Add sub-app route registration method
        routeInterface.registerSubAppRoutes = (appName, routes) => {
            this.subAppRoutes.set(appName, routes);
            logger.info(`Registered routes for sub-app: ${appName}`);

            // Register routes with the HTTP server if it's running
            if (this.httpServer) {
                this.registerSubAppRoutes(appName, routes);
            }
        };

        // Add WebSocket handler registration for sub-apps
        routeInterface.registerSubAppWsHandlers = (appName, handlers) => {
            for (const [method, handler] of Object.entries(handlers)) {
                const methodName = `${appName}.${method}`;
                routeInterface.addWsHandler(methodName, handler);
                logger.info(`Registered WebSocket handler: ${methodName}`);
            }
        };

        // Store route interface for external access
        this.routeInterface = routeInterface;
    }

    registerCoreRoutes() {
        if (!this.itToolsInstance) {
            return;
        }

        // Core API routes
        this.itToolsInstance.httpServer.app.get('/api/integration/status', (req, res) => {
            try {
                const status = this.getIntegrationStatus();
                res.json({
                    success: true,
                    data: status,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Sub-app management routes
        this.itToolsInstance.httpServer.app.get('/api/integration/subapps', (req, res) => {
            try {
                const subApps = Array.from(this.subAppRoutes.keys());
                res.json({
                    success: true,
                    data: {
                        subApps: subApps,
                        count: subApps.length
                    },
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // WebSocket status
        this.itToolsInstance.httpServer.app.get('/api/integration/websocket/status', (req, res) => {
            try {
                const wsStatus = this.getWebSocketStatus();
                res.json({
                    success: true,
                    data: wsStatus,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });
    }

    registerSubAppRoutes(appName, routes) {
        if (!this.httpServer || !this.httpServer.app) {
            return;
        }

        const app = this.httpServer.app;

        // Register routes with prefix
        const prefix = `/api/apps/${appName}`;

        for (const route of routes) {
            const { method, path, handler } = route;
            const fullPath = `${prefix}${path}`;

            app[method.toLowerCase()](fullPath, handler);
            logger.info(`Registered sub-app route: ${method.toUpperCase()} ${fullPath} (${appName})`);
        }
    }

    registerWebSocketHandlers() {
        if (!this.wsRpcServer) {
            return;
        }

        // Integration status handler
        this.wsRpcServer.route('integration.status', async () => {
            return this.getIntegrationStatus();
        });

        // Sub-app list handler
        this.wsRpcServer.route('integration.subapps', async () => {
            return {
                subApps: Array.from(this.subAppRoutes.keys()),
                count: this.subAppRoutes.size
            };
        });

        // WebSocket status handler
        this.wsRpcServer.route('integration.websocket.status', async () => {
            return this.getWebSocketStatus();
        });

        // Sub-app route registration handler
        this.wsRpcServer.route('integration.register.routes', async (params) => {
            const { appName, routes } = params;
            return this.registerSubAppRoutesFromParams(appName, routes);
        });

        // Sub-app WebSocket handler registration
        this.wsRpcServer.route('integration.register.ws_handlers', async (params) => {
            const { appName, handlers } = params;
            return this.registerSubAppWsHandlersFromParams(appName, handlers);
        });
    }

    registerSubAppRoutesFromParams(appName, routes) {
        try {
            const parsedRoutes = Array.isArray(routes) ? routes : [routes];

            this.subAppRoutes.set(appName, parsedRoutes);

            if (this.httpServer) {
                this.registerSubAppRoutes(appName, parsedRoutes);
            }

            return {
                success: true,
                appName: appName,
                routesCount: parsedRoutes.length,
                message: `Successfully registered ${parsedRoutes.length} routes for ${appName}`
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                appName: appName
            };
        }
    }

    registerSubAppWsHandlersFromParams(appName, handlers) {
        try {
            if (!this.routeInterface || typeof this.routeInterface.addWsHandler !== 'function') {
                return {
                    success: false,
                    error: 'Route interface not available',
                    appName: appName
                };
            }

            const handlerEntries = Object.entries(handlers || {});
            let registeredCount = 0;

            for (const [method, handler] of handlerEntries) {
                if (typeof handler !== 'function') {
                    logger.warn(`Invalid WebSocket handler for ${appName}.${method} - expected function`);
                    continue;
                }
                const methodName = `${appName}.${method}`;
                this.routeInterface.addWsHandler(methodName, handler);
                registeredCount++;
            }

            return {
                success: true,
                appName: appName,
                handlersCount: registeredCount,
                message: `Successfully registered ${registeredCount} WebSocket handlers for ${appName}`
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                appName: appName
            };
        }
    }

    registerSubAppController(appName, controller) {
        if (!controller) {
            logger.warn(`Cannot register controller: controller is null for ${appName}`);
            return false;
        }

        try {
            this.subAppControllers.set(appName, controller);
            logger.info(`Registered sub-app controller: ${appName}`);

            if (this.wsRpcServer && typeof controller.registerWebSocketRoutes === 'function') {
                controller.registerWebSocketRoutes(this.wsRpcServer);
                logger.info(`Registered WebSocket routes for sub-app: ${appName}`);
            }

            return true;
        } catch (error) {
            logger.error(`Failed to register sub-app controller ${appName}: ${error.message}`);
            return false;
        }
    }

    async startServers(options = {}) {
        if (!this.initialized) {
            throw new Error('ITToolsIntegrationController not initialized');
        }

        try {
            const serverConfig = { ...this.config, ...options };
            this.config = serverConfig;

            const serverResult = await this.itToolsInstance.startServer({
                port: serverConfig.httpPort,
                host: serverConfig.host,
                enableHttp: serverConfig.enableHttp,
                enableWs: serverConfig.enableWebSocket,
                wsPort: serverConfig.wsPort,
                staticDir: serverConfig.staticDir,
                cors: serverConfig.enableCors
            });

            this.httpServer = serverResult.httpServer || null;
            this.wsRpcServer = serverResult.wsRpcServer || null;

            // Register core routes after server is started
            this.registerCoreRoutes();

            // Register WebSocket handlers after server is started
            this.registerWebSocketHandlers();

            // Register sub-app routes if any
            for (const [appName, routes] of this.subAppRoutes) {
                this.registerSubAppRoutes(appName, routes);
            }

            // Register sub-app controllers WebSocket routes if any
            for (const [appName, controller] of this.subAppControllers) {
                if (this.wsRpcServer && typeof controller.registerWebSocketRoutes === 'function') {
                    controller.registerWebSocketRoutes(this.wsRpcServer);
                    logger.info(`Registered WebSocket routes for controller: ${appName}`);
                }
            }

            if (this.httpServer && serverConfig.enableHttp !== false) {
                logger.info(`ITTools Integration HTTP server started on ${serverConfig.host}:${serverConfig.httpPort}`);
            } else {
                logger.info('ITTools Integration HTTP server not started (disabled)');
            }

            if (this.wsRpcServer && serverConfig.enableWebSocket) {
                const effectiveWsPort = serverConfig.wsPort || (serverConfig.enableHttp !== false ? serverConfig.httpPort + 1 : serverConfig.httpPort);
                logger.info(`ITTools Integration WebSocket server started on ws://${serverConfig.host}:${effectiveWsPort}`);
            } else if (!serverConfig.enableWebSocket) {
                logger.info('ITTools Integration WebSocket server disabled by configuration');
            }

            // Return the route interface for external use
            return {
                httpServer: this.httpServer,
                wsRpcServer: this.wsRpcServer,
                routeInterface: this.routeInterface,
                config: serverConfig
            };
        } catch (error) {
            logger.error(`Failed to start ITTools Integration servers: ${error.message}`);
            throw error;
        }
    }

    async stopServers() {
        try {
            // Stop ittools server (includes both HTTP and WebSocket)
            if (this.itToolsInstance) {
                await this.itToolsInstance.stopServer();
                this.httpServer = null;
                this.wsRpcServer = null;
            }

            logger.info('ITTools Integration servers stopped successfully');
        } catch (error) {
            logger.error(`Failed to stop ITTools Integration servers: ${error.message}`);
            throw error;
        }
    }

    getIntegrationStatus() {
        const serverStatus = this.itToolsInstance ? this.itToolsInstance.getServerStatus() : null;
        const httpStatus = serverStatus ? serverStatus.httpServer : null;
        const wsStatus = serverStatus ? serverStatus.websocketServer : null;

        return {
            name: this.name,
            version: this.version,
            initialized: this.initialized,
            itToolsStatus: this.itToolsInstance ? this.itToolsInstance.getStatus() : null,
            subApps: {
                registered: Array.from(this.subAppRoutes.keys()),
                count: this.subAppRoutes.size
            },
            servers: {
                http: {
                    enabled: httpStatus ? httpStatus.enabled : this.config.enableHttp,
                    running: httpStatus ? httpStatus.running : this.httpServer !== null,
                    port: httpStatus && httpStatus.port !== null ? httpStatus.port : this.config.httpPort,
                    host: this.config.host
                },
                websocket: {
                    enabled: wsStatus ? wsStatus.enabled : this.config.enableWebSocket,
                    running: wsStatus ? wsStatus.running : this.wsRpcServer !== null,
                    port: wsStatus && wsStatus.port !== null ? wsStatus.port : this.config.wsPort,
                    host: this.config.host
                }
            },
            config: this.config
        };
    }

    getWebSocketStatus() {
        const serverStatus = this.itToolsInstance ? this.itToolsInstance.getServerStatus() : null;
        const wsStatus = serverStatus ? serverStatus.websocketServer : null;
        const registeredMethods = this.wsRpcServer && this.wsRpcServer.routes ?
            Array.from(this.wsRpcServer.routes.keys()) : [];
        const connectedClients = this.wsRpcServer && typeof this.wsRpcServer.getClients === 'function' ?
            this.wsRpcServer.getClients().length : 0;

        return {
            enabled: wsStatus ? wsStatus.enabled : this.config.enableWebSocket,
            running: wsStatus ? wsStatus.running : this.wsRpcServer !== null,
            port: wsStatus && wsStatus.port !== null ? wsStatus.port : this.config.wsPort,
            host: this.config.host,
            registeredMethods: registeredMethods,
            connectedClients: connectedClients
        };
    }

    getRouteInterface() {
        if (!this.routeInterface) {
            throw new Error('Route interface not available - controller not initialized');
        }
        return this.routeInterface;
    }

    // Static factory method
    static async create(config = {}) {
        const controller = new ITToolsIntegrationController();
        await controller.initialize(config);
        return controller;
    }
}

module.exports = ITToolsIntegrationController;
