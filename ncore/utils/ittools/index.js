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

const logger = require('./../../foundation/common/logger');
const httpUtils = require('../http-wrapper');
const wsRpcUtils = require('../ws_rpc');
const CryptoTools = require('./tools/crypto');
const ConverterTools = require('./tools/converter');
const WebTools = require('./tools/web');
const TextTools = require('./tools/text');
const MathTools = require('./tools/math');
const NetworkTools = require('./tools/network');
const MediaTools = require('./tools/media');
const DevelopmentTools = require('./tools/development');
const MeasurementTools = require('./tools/measurement');
const DataTools = require('./tools/data');

class EnhancedItTools {
    constructor() {
        this.name = 'ittools';
        this.version = '2.0.0';
        this.crypto = null;
        this.converter = null;
        this.web = null;
        this.text = null;
        this.math = null;
        this.network = null;
        this.media = null;
        this.development = null;
        this.measurement = null;
        this.data = null;
        this.httpServer = null;
        this.wsRpcServer = null;
        this.routes = new Map();
        this.wsHandlers = new Map();
        this.initialized = false;
        this.serverRunning = false;
        this.config = {
            port: 8080,
            host: 'localhost',
            enableWs: true,
            staticDir: null,
            cors: true
        };
    }

    async initialize(config = {}) {
        if (this.initialized) {
            logger.warn('EnhancedItTools already initialized');
            return this;
        }

        try {
            logger.info('Initializing EnhancedItTools...');

            // Merge configuration
            this.config = { ...this.config, ...config };

            // Initialize tool components
            this.crypto = new CryptoTools();
            this.converter = new ConverterTools();
            this.web = new WebTools();
            this.text = new TextTools();
            this.math = new MathTools();
            this.network = new NetworkTools();
            this.media = new MediaTools();
            this.development = new DevelopmentTools();
            this.measurement = new MeasurementTools();
            this.data = new DataTools();

            this.initialized = true;
            logger.info('EnhancedItTools initialized successfully');
            return this;
        } catch (error) {
            logger.error(`Failed to initialize EnhancedItTools: ${error.message}`);
            throw error;
        }
    }

    createRouteInterface() {
        return {
            // REST API routes
            addRoute: (method, path, handler) => {
                const routeKey = `${method.toUpperCase()}:${path}`;
                this.routes.set(routeKey, handler);
                logger.info(`Added route: ${method.toUpperCase()} ${path}`);
            },

            // WebSocket handlers
            addWsHandler: (method, handler) => {
                this.wsHandlers.set(method, handler);
                logger.info(`Added WebSocket handler: ${method}`);
            },

            // Tool execution
            executeTool: async (toolId, params) => {
                return await this.executeTool(toolId, params);
            },

            // Tool management
            getToolList: () => this.getAllTools(),
            searchTools: (query) => this.searchTools(query),
            getToolsByCategory: (category) => this.getToolsByCategory(category),

            // Server management
            startServer: async (options = {}) => {
                return await this.startServer(options);
            },
            stopServer: async () => {
                return await this.stopServer();
            },
            getServerStatus: () => this.getServerStatus()
        };
    }

    async startServer(options = {}) {
        if (this.serverRunning) {
            logger.warn('EnhancedItTools server is already running');
            return this.httpServer;
        }

        try {
            const serverConfig = { ...this.config, ...options };

            // Initialize HTTP server with Express
            this.httpServer = httpUtils.createServer({
                port: serverConfig.port,
                host: serverConfig.host,
                staticDir: serverConfig.staticDir,
                cors: serverConfig.cors
            });

            // Register custom routes
            this.registerRoutes();

            // Initialize WebSocket if enabled
            if (serverConfig.enableWs) {
                await this.initializeWebSocket();
            }

            // Start the server
            await httpUtils.startServer(this.httpServer);
            this.serverRunning = true;

            logger.info(`EnhancedItTools server started on ${serverConfig.host}:${serverConfig.port}`);
            return this.httpServer;
        } catch (error) {
            logger.error(`Failed to start EnhancedItTools server: ${error.message}`);
            throw error;
        }
    }

    async stopServer() {
        if (!this.serverRunning) {
            logger.warn('EnhancedItTools server is not running');
            return;
        }

        try {
            // Stop WebSocket server
            if (this.wsRpcServer) {
                await wsRpcUtils.stopServer();
                this.wsRpcServer = null;
            }

            // Stop HTTP server
            if (this.httpServer) {
                await httpUtils.stopServer();
                this.httpServer = null;
            }

            this.serverRunning = false;
            logger.info('EnhancedItTools server stopped successfully');
        } catch (error) {
            logger.error(`Failed to stop EnhancedItTools server: ${error.message}`);
            throw error;
        }
    }

    registerRoutes() {
        if (!this.httpServer) {
            return;
        }

        const app = this.httpServer.app;

        // API routes
        app.get('/api/tools', (req, res) => {
            try {
                const tools = this.getAllTools();
                res.json({
                    success: true,
                    data: tools,
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

        app.get('/api/tools/category/:category', (req, res) => {
            try {
                const { category } = req.params;
                const tools = this.getToolsByCategory(category);
                res.json({
                    success: true,
                    data: tools,
                    category: category,
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

        app.get('/api/tools/search', (req, res) => {
            try {
                const { q } = req.query;
                if (!q) {
                    return res.status(400).json({
                        success: false,
                        error: 'Query parameter "q" is required',
                        timestamp: new Date().toISOString()
                    });
                }

                const tools = this.searchTools(q);
                res.json({
                    success: true,
                    data: tools,
                    query: q,
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

        app.post('/api/tools/:toolId/execute', async (req, res) => {
            try {
                const { toolId } = req.params;
                const params = req.body || {};

                const result = await this.executeTool(toolId, params);
                res.json(result);
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        app.get('/api/status', (req, res) => {
            try {
                const status = this.getServerStatus();
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

        // Register custom routes
        for (const [routeKey, handler] of this.routes) {
            const [method, path] = routeKey.split(':');
            app[method.toLowerCase()](path, handler);
        }
    }

    async initializeWebSocket() {
        try {
            // Initialize WebSocket RPC server
            this.wsRpcServer = wsRpcUtils.createServer({
                port: this.config.port + 1, // WebSocket on port + 1
                host: this.config.host
            });

            // Register WebSocket handlers
            this.registerWebSocketHandlers();

            // Start WebSocket server
            await wsRpcUtils.startServer(this.wsRpcServer);
            logger.info(`WebSocket RPC server started on ${this.config.host}:${this.config.port + 1}`);
        } catch (error) {
            logger.error(`Failed to initialize WebSocket: ${error.message}`);
            throw error;
        }
    }

    registerWebSocketHandlers() {
        if (!this.wsRpcServer) {
            return;
        }

        // Tool execution handler
        this.wsRpcServer.registerMethod('tools.execute', async (params) => {
            const { toolId, ...toolParams } = params;
            return await this.executeTool(toolId, toolParams);
        });

        // Tool listing handler
        this.wsRpcServer.registerMethod('tools.list', async () => {
            return this.getAllTools();
        });

        // Tool search handler
        this.wsRpcServer.registerMethod('tools.search', async (params) => {
            const { query } = params;
            return this.searchTools(query);
        });

        // Tool category handler
        this.wsRpcServer.registerMethod('tools.category', async (params) => {
            const { category } = params;
            return this.getToolsByCategory(category);
        });

        // Status handler
        this.wsRpcServer.registerMethod('server.status', async () => {
            return this.getServerStatus();
        });

        // Register custom WebSocket handlers
        for (const [method, handler] of this.wsHandlers) {
            this.wsRpcServer.registerMethod(method, handler);
        }
    }

    getAllTools() {
        const cryptoTools = this.crypto.getToolList();
        const converterTools = this.converter.getToolList();
        const webTools = this.web.getToolList();
        const textTools = this.text.getToolList();
        const mathTools = this.math.getToolList();
        const networkTools = this.network.getToolList();
        const mediaTools = this.media.getToolList();
        const developmentTools = this.development.getToolList();
        const measurementTools = this.measurement.getToolList();
        const dataTools = this.data.getToolList();

        return [
            ...cryptoTools,
            ...converterTools,
            ...webTools,
            ...textTools,
            ...mathTools,
            ...networkTools,
            ...mediaTools,
            ...developmentTools,
            ...measurementTools,
            ...dataTools
        ];
    }

    getToolsByCategory(category) {
        const categoryMap = {
            'crypto': this.crypto,
            'converter': this.converter,
            'web': this.web,
            'text': this.text,
            'math': this.math,
            'network': this.network,
            'media': this.media,
            'development': this.development,
            'measurement': this.measurement,
            'data': this.data
        };

        const toolHandler = categoryMap[category];
        if (!toolHandler) {
            return [];
        }

        return toolHandler.getToolList();
    }

    searchTools(query) {
        const lowerQuery = query.toLowerCase();
        const allTools = this.getAllTools();

        return allTools.filter(tool => {
            const nameMatch = tool.name.toLowerCase().includes(lowerQuery);
            const descMatch = tool.description.toLowerCase().includes(lowerQuery);
            const keywordMatch = tool.keywords.some(k => k.toLowerCase().includes(lowerQuery));
            return nameMatch || descMatch || keywordMatch;
        });
    }

    async executeTool(toolId, params) {
        const startTime = Date.now();
        let result = null;
        let error = null;

        try {
            const tool = this.getAllTools().find(t => t.id === toolId);
            if (!tool) {
                throw new Error(`Unknown tool: ${toolId}`);
            }

            const category = tool.category;

            switch (category) {
                case 'crypto':
                    result = await this.crypto.execute(toolId, params);
                    break;
                case 'converter':
                    result = await this.converter.execute(toolId, params);
                    break;
                case 'web':
                    result = await this.web.execute(toolId, params);
                    break;
                case 'text':
                    result = await this.text.execute(toolId, params);
                    break;
                case 'math':
                    result = await this.math.execute(toolId, params);
                    break;
                case 'network':
                    result = await this.network.execute(toolId, params);
                    break;
                case 'media':
                    result = await this.media.execute(toolId, params);
                    break;
                case 'development':
                    result = await this.development.execute(toolId, params);
                    break;
                case 'measurement':
                    result = await this.measurement.execute(toolId, params);
                    break;
                case 'data':
                    result = await this.data.execute(toolId, params);
                    break;
                default:
                    throw new Error(`Unknown category: ${category}`);
            }
        } catch (err) {
            error = err.message;
            logger.error(`Error executing tool ${toolId}: ${error}`);
        }

        const executionTime = Date.now() - startTime;

        return {
            success: !error,
            data: result,
            error: error,
            timestamp: new Date().toISOString(),
            executionTime: executionTime
        };
    }

    getServerStatus() {
        return {
            name: this.name,
            version: this.version,
            initialized: this.initialized,
            serverRunning: this.serverRunning,
            config: {
                port: this.config.port,
                host: this.config.host,
                enableWs: this.config.enableWs,
                cors: this.config.cors
            },
            tools: {
                crypto: this.crypto ? this.crypto.getToolList().length : 0,
                converter: this.converter ? this.converter.getToolList().length : 0,
                web: this.web ? this.web.getToolList().length : 0,
                text: this.text ? this.text.getToolList().length : 0,
                math: this.math ? this.math.getToolList().length : 0,
                network: this.network ? this.network.getToolList().length : 0
            },
            routes: this.routes.size,
            wsHandlers: this.wsHandlers.size
        };
    }

    getStatus() {
        return this.getServerStatus();
    }
}

let instance = null;

function getInstance() {
    if (!instance) {
        instance = new EnhancedItTools();
    }
    return instance;
}

module.exports = {
    getInstance,
    EnhancedItTools
};