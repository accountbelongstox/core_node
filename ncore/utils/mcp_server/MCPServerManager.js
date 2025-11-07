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

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const logger = require('#@logger');
const SessionManager = require('./SessionManager');
const ToolRegistry = require('./ToolRegistry');

/**
 * MCP Server Manager
 * Core class for managing MCP server lifecycle, tools, and sessions
 *
 * @class MCPServerManager
 */
class MCPServerManager {
    constructor(options = {}) {
        this.serverName = options.serverName || 'mcp_server';
        this.serverVersion = options.serverVersion || '1.0.0';
        this.server = null;
        this.transport = null;
        this.sessionManager = new SessionManager(options.sessionConfig || {});
        this.toolRegistry = new ToolRegistry();
        this.initialized = false;
        this.running = false;
        this.capabilities = options.capabilities || { tools: {} };
    }

    /**
     * Initialize MCP server
     */
    async initialize() {
        if (this.initialized) {
            logger.warn('MCP Server already initialized');
            return;
        }

        logger.info(`Initializing MCP Server: ${this.serverName} v${this.serverVersion}...`);

        try {
            this.server = new Server(
                {
                    name: this.serverName,
                    version: this.serverVersion,
                },
                {
                    capabilities: this.capabilities,
                }
            );

            this.setupHandlers();
            this.sessionManager.startCleanup();
            this.initialized = true;

            logger.info('MCP Server initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize MCP Server:', error.message);
            throw error;
        }
    }

    /**
     * Setup MCP request handlers
     */
    setupHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            try {
                return {
                    tools: this.toolRegistry.getTools(),
                };
            } catch (error) {
                logger.error('Error listing tools:', error.message);
                return { tools: [] };
            }
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            try {
                logger.debug(`Executing tool: ${name}`);
                const result = await this.toolRegistry.executeTool(name, args || {});

                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            } catch (error) {
                logger.error(`Error executing tool ${name}:`, error.message);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: false,
                                error: error.message,
                                tool: name
                            }, null, 2),
                        },
                    ],
                    isError: true,
                };
            }
        });
    }

    /**
     * Register a tool instance
     * @param {Object} toolInstance - Tool instance with getTools() and executeTool() methods
     */
    registerTool(toolInstance) {
        if (!this.initialized) {
            throw new Error('MCP Server not initialized. Call initialize() first.');
        }

        this.toolRegistry.register(toolInstance);
        logger.info(`Tool registered: ${toolInstance.constructor.name}`);
    }

    /**
     * Unregister a tool by name
     * @param {string} toolName - Name of the tool to unregister
     */
    unregisterTool(toolName) {
        this.toolRegistry.unregister(toolName);
    }

    /**
     * Start MCP server
     */
    async start() {
        if (!this.initialized) {
            await this.initialize();
        }

        if (this.running) {
            logger.warn('MCP Server already running');
            return this.server;
        }

        try {
            this.transport = new StdioServerTransport();
            await this.server.connect(this.transport);
            this.running = true;

            logger.info('MCP Server started successfully');

            this.setupSignalHandlers();

            return this.server;
        } catch (error) {
            logger.error('Failed to start MCP Server:', error.message);
            throw error;
        }
    }

    /**
     * Setup process signal handlers for graceful shutdown
     */
    setupSignalHandlers() {
        const shutdownHandler = async (signal) => {
            logger.info(`Received ${signal}, shutting down MCP Server...`);
            await this.shutdown();
            process.exit(0);
        };

        process.on('SIGINT', shutdownHandler);
        process.on('SIGTERM', shutdownHandler);
    }

    /**
     * Shutdown MCP server gracefully
     */
    async shutdown() {
        if (!this.running) {
            return;
        }

        try {
            logger.info('Shutting down MCP Server...');

            this.sessionManager.stopCleanup();

            if (this.server) {
                await this.server.close();
            }

            this.running = false;
            logger.info('MCP Server shutdown complete');
        } catch (error) {
            logger.error('Error during MCP Server shutdown:', error.message);
        }
    }

    /**
     * Get server statistics
     */
    getStats() {
        return {
            server: {
                name: this.serverName,
                version: this.serverVersion,
                running: this.running,
                initialized: this.initialized
            },
            sessions: this.sessionManager.getStats(),
            tools: this.toolRegistry.getStats(),
            uptime: process.uptime(),
            memory: process.memoryUsage()
        };
    }

    /**
     * Get session manager
     */
    getSessionManager() {
        return this.sessionManager;
    }

    /**
     * Get tool registry
     */
    getToolRegistry() {
        return this.toolRegistry;
    }

    /**
     * Check if server is running
     */
    isRunning() {
        return this.running;
    }

    /**
     * Check if server is initialized
     */
    isInitialized() {
        return this.initialized;
    }
}

module.exports = MCPServerManager;
