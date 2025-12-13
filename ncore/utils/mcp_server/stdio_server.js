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
    ListResourcesRequestSchema,
    ListPromptsRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');
const logger = require('#@logger');
const { getInstance: getConfigLoader } = require('./config_loader');
const ServiceManager = require('./service_manager');

/**
 * STDIO MCP Server
 * Main STDIO server for aggregating MCP services
 */
class StdioServer {
    constructor(options = {}) {
        this.options = options;
        this.server = null;
        this.serviceManager = new ServiceManager();
        this.configLoader = getConfigLoader();
        this.isShuttingDown = false;
    }

    /**
     * Setup MCP request handlers
     */
    setupHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            logger.info('[MCP Server] ListTools request received');

            try {
                const config = await this.configLoader.loadConfig();
                const tools = await this.serviceManager.getAllTools(config);

                logger.info(`[MCP Server] Total tools available: ${tools.length}`);
                return { tools };

            } catch (error) {
                logger.error('[MCP Server] Failed to list tools:', error.message);

                return {
                    tools: [{
                        name: 'ncore_error',
                        description: `Error loading tools: ${error.message}`,
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    }]
                };
            }
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            logger.info(`[MCP Server] CallTool request: ${name}`);

            if (!name.includes('__')) {
                logger.error('[MCP Server] Invalid tool name format:', name);
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: false,
                            error: 'Invalid tool name format. Expected: service__toolname',
                            tool: name
                        })
                    }],
                    isError: true
                };
            }

            const [serviceName, ...toolNameParts] = name.split('__');
            const toolName = toolNameParts.join('__');

            try {
                const config = await this.configLoader.loadConfig();
                const serviceConfig = config.services[serviceName];

                if (!serviceConfig) {
                    logger.error(`[MCP Server] Service not found: ${serviceName}`);
                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify({
                                success: false,
                                error: `Service '${serviceName}' not found in configuration`
                            })
                        }],
                        isError: true
                    };
                }

                return await this.serviceManager.callTool(serviceName, toolName, args, serviceConfig);

            } catch (error) {
                logger.error(`[MCP Server] Tool call error (${name}):`, error.message);
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: false,
                            error: error.message,
                            tool: name
                        })
                    }],
                    isError: true
                };
            }
        });

        this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
            logger.info('[MCP Server] ListResources request received');
            return { resources: [] };
        });

        this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
            logger.info('[MCP Server] ListPrompts request received');
            return { prompts: [] };
        });
    }

    /**
     * Start STDIO server
     * @returns {Promise<void>}
     */
    async start() {
        try {
            logger.info('[MCP Server] Starting ncore MCP STDIO Server...');

            const config = await this.configLoader.loadConfig();
            const enabledServices = Object.entries(config.services || {})
                .filter(([, cfg]) => cfg.enabled)
                .map(([name]) => name);

            logger.info(`[MCP Server] Enabled services: ${enabledServices.join(', ')}`);

            this.server = new Server(
                {
                    name: 'ncore-mcp-stdio',
                    version: '1.0.0'
                },
                {
                    capabilities: {
                        tools: {},
                        resources: {},
                        prompts: {}
                    }
                }
            );

            this.setupHandlers();

            const transport = new StdioServerTransport();
            await this.server.connect(transport);

            logger.info('[MCP Server] Server started successfully');
            logger.info('[MCP Server] Aggregating tools from multiple services...');
            logger.info('[MCP Server] Waiting for requests from Claude Desktop...');

        } catch (error) {
            logger.error('[MCP Server] Failed to start server:', error.message);
            if (error.stack) {
                logger.error('[MCP Server] Stack:', error.stack);
            }
        }
    }

    /**
     * Stop STDIO server
     * @returns {Promise<void>}
     */
    async stop() {
        if (this.isShuttingDown) {
            return;
        }

        this.isShuttingDown = true;
        logger.info('[MCP Server] Shutting down...');

        try {
            await this.serviceManager.closeAll();

            if (this.server) {
                await this.server.close();
                this.server = null;
            }

            logger.info('[MCP Server] Shutdown complete');

        } catch (error) {
            logger.error('[MCP Server] Error during shutdown:', error.message);
        }
    }

    /**
     * Get server status
     * @returns {Object}
     */
    getStatus() {
        return {
            running: !!this.server && !this.isShuttingDown,
            services: this.serviceManager.getServiceNames(),
            serviceCount: this.serviceManager.getServiceCount(),
            configPath: this.configLoader.getConfigPath()
        };
    }
}

module.exports = StdioServer;
