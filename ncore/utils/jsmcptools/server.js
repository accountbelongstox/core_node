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

const fastify = require('fastify');
const cors = require('@fastify/cors');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { randomUUID } = require('crypto');
const { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ListPromptsRequestSchema, isInitializeRequest } = require('@modelcontextprotocol/sdk/types.js');
const logger = require('#@logger');
const { MCP_CHROME_PORT, TOOL_NAMES } = require('./tool_schemas');

const HTTP_STATUS = {
    OK: 200,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    INTERNAL_SERVER_ERROR: 500,
    GATEWAY_TIMEOUT: 504
};

const ERROR_MESSAGES = {
    NATIVE_HOST_NOT_AVAILABLE: 'Native host not available',
    SERVER_NOT_RUNNING: 'Server not running',
    REQUEST_TIMEOUT: 'Request timeout',
    INTERNAL_SERVER_ERROR: 'Internal server error',
    INVALID_MCP_REQUEST: 'Invalid MCP request',
    INVALID_SSE_SESSION: 'Invalid SSE session',
    INVALID_SESSION_ID: 'Invalid session ID',
    MCP_REQUEST_PROCESSING_ERROR: 'MCP request processing error',
    MCP_SESSION_DELETION_ERROR: 'MCP session deletion error'
};

/**
 * MCP Chrome HTTP Server
 * Provides MCP protocol server with HTTP transport for Chrome extension integration
 */
class MCPChromeServer {
    constructor(options = {}) {
        this.port = options.port || MCP_CHROME_PORT;
        this.host = options.host || '127.0.0.1';
        this.fastifyInstance = null;
        this.mcpServer = null;
        this.isRunning = false;
        this.transportsMap = new Map();
        this.toolHandlers = new Map();
        this.extensionConnected = false;
    }

    /**
     * Initialize Fastify and MCP Server
     */
    async initialize() {
        this.fastifyInstance = fastify({ logger: false });

        await this.fastifyInstance.register(cors, {
            origin: '*'
        });

        this.mcpServer = new Server(
            {
                name: 'chrome-mcp-server',
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

        this.setupMCPHandlers();
        this.setupHTTPRoutes();

        logger.info('[MCP Chrome] Server initialized');
    }

    /**
     * Setup MCP protocol handlers
     */
    setupMCPHandlers() {
        this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
            const tools = [];
            for (const handler of this.toolHandlers.values()) {
                if (handler.getTool) {
                    tools.push(handler.getTool());
                }
            }
            return { tools };
        });

        this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            try {
                logger.debug(`[MCP Chrome] Executing tool: ${name}`);

                const handler = this.toolHandlers.get(name);
                if (!handler) {
                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify({ success: false, error: `Tool '${name}' not found` })
                        }],
                        isError: true
                    };
                }

                const result = await handler.execute(args || {});

                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            } catch (error) {
                logger.error(`[MCP Chrome] Tool execution error (${name}):`, error.message);
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({ success: false, error: error.message })
                    }],
                    isError: true
                };
            }
        });

        this.mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));
        this.mcpServer.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: [] }));
    }

    /**
     * Setup HTTP routes for MCP and extension communication
     */
    setupHTTPRoutes() {
        this.fastifyInstance.post('/mcp', async (request, reply) => {
            const sessionId = request.headers['mcp-session-id'];
            let transport = this.transportsMap.get(sessionId || '');

            if (transport) {
                // Transport found
            } else if (!sessionId && isInitializeRequest(request.body)) {
                const newSessionId = randomUUID();
                transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => newSessionId,
                    onsessioninitialized: (initializedSessionId) => {
                        if (transport && initializedSessionId === newSessionId) {
                            this.transportsMap.set(initializedSessionId, transport);
                        }
                    }
                });

                transport.onclose = () => {
                    if (transport?.sessionId && this.transportsMap.get(transport.sessionId)) {
                        this.transportsMap.delete(transport.sessionId);
                    }
                };

                await this.mcpServer.connect(transport);
            } else {
                reply.code(HTTP_STATUS.BAD_REQUEST).send({ error: ERROR_MESSAGES.INVALID_MCP_REQUEST });
                return;
            }

            try {
                await transport.handleRequest(request.raw, reply.raw, request.body);
            } catch (error) {
                if (!reply.sent) {
                    reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ error: ERROR_MESSAGES.MCP_REQUEST_PROCESSING_ERROR });
                }
            }
        });

        this.fastifyInstance.get('/mcp', async (request, reply) => {
            const sessionId = request.headers['mcp-session-id'];
            const transport = sessionId ? this.transportsMap.get(sessionId) : undefined;

            if (!transport) {
                reply.code(HTTP_STATUS.BAD_REQUEST).send({ error: ERROR_MESSAGES.INVALID_SSE_SESSION });
                return;
            }

            reply.raw.setHeader('Content-Type', 'text/event-stream');
            reply.raw.setHeader('Cache-Control', 'no-cache');
            reply.raw.setHeader('Connection', 'keep-alive');
            reply.raw.flushHeaders();

            try {
                await transport.handleRequest(request.raw, reply.raw);
                if (!reply.sent) {
                    reply.hijack();
                }
            } catch (error) {
                if (!reply.raw.writableEnded) {
                    reply.raw.end();
                }
            }

            request.socket.on('close', () => {
                logger.debug(`[MCP Chrome] SSE client disconnected for session: ${sessionId}`);
            });
        });

        this.fastifyInstance.delete('/mcp', async (request, reply) => {
            const sessionId = request.headers['mcp-session-id'];
            const transport = sessionId ? this.transportsMap.get(sessionId) : undefined;

            if (!transport) {
                reply.code(HTTP_STATUS.BAD_REQUEST).send({ error: ERROR_MESSAGES.INVALID_SESSION_ID });
                return;
            }

            try {
                await transport.handleRequest(request.raw, reply.raw);
                if (!reply.sent) {
                    reply.code(HTTP_STATUS.NO_CONTENT).send();
                }
            } catch (error) {
                if (!reply.sent) {
                    reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ error: ERROR_MESSAGES.MCP_SESSION_DELETION_ERROR });
                }
            }
        });

        this.fastifyInstance.get('/health', async (request, reply) => {
            return {
                status: 'healthy',
                service: 'mcp-chrome-server',
                extensionConnected: this.extensionConnected,
                transports: this.transportsMap.size,
                tools: this.toolHandlers.size,
                timestamp: new Date().toISOString()
            };
        });

        this.fastifyInstance.get('/extension-ping', async (request, reply) => {
            this.extensionConnected = true;
            return { status: 'pong', timestamp: new Date().toISOString() };
        });
    }

    /**
     * Register a tool handler
     * @param {string} toolName - Tool name
     * @param {Object} handler - Handler with execute() and getTool() methods
     */
    registerTool(toolName, handler) {
        this.toolHandlers.set(toolName, handler);
        logger.info(`[MCP Chrome] Tool registered: ${toolName}`);
    }

    /**
     * Unregister a tool handler
     * @param {string} toolName - Tool name
     */
    unregisterTool(toolName) {
        this.toolHandlers.delete(toolName);
        logger.info(`[MCP Chrome] Tool unregistered: ${toolName}`);
    }

    /**
     * Start the server
     */
    async start() {
        if (this.isRunning) {
            logger.warn('[MCP Chrome] Server already running');
            return;
        }

        if (!this.fastifyInstance) {
            await this.initialize();
        }

        try {
            await this.fastifyInstance.listen({ port: this.port, host: this.host });
            this.isRunning = true;

            logger.info('='.repeat(60));
            logger.info('[MCP Chrome] MCP Chrome Server Started');
            logger.info('='.repeat(60));
            logger.info(`[MCP Chrome] MCP Endpoint:    http://${this.host}:${this.port}/mcp`);
            logger.info(`[MCP Chrome] Health Check:    http://${this.host}:${this.port}/health`);
            logger.info('='.repeat(60));
            logger.info('[MCP Chrome] Chrome Extension Setup Required:');
            logger.info('[MCP Chrome] 1. Open Chrome: chrome://extensions/');
            logger.info('[MCP Chrome] 2. Enable "Developer mode"');
            logger.info('[MCP Chrome] 3. Load unpacked extension from Chrome MCP extension folder');
            logger.info('[MCP Chrome] 4. Click extension icon and "Connect"');
            logger.info('='.repeat(60));
        } catch (error) {
            logger.error('[MCP Chrome] Failed to start server:', error.message);
            this.isRunning = false;
            throw error;
        }
    }

    /**
     * Stop the server
     */
    async stop() {
        if (!this.isRunning) {
            logger.warn('[MCP Chrome] Server not running');
            return;
        }

        try {
            logger.info('[MCP Chrome] Stopping MCP Chrome Server...');

            for (const [sessionId, transport] of this.transportsMap.entries()) {
                try {
                    if (transport.close) {
                        await transport.close();
                    }
                } catch (error) {
                    logger.error(`[MCP Chrome] Error closing transport ${sessionId}:`, error.message);
                }
            }

            this.transportsMap.clear();

            if (this.fastifyInstance) {
                await this.fastifyInstance.close();
            }

            this.isRunning = false;
            logger.info('[MCP Chrome] Server stopped successfully');
        } catch (error) {
            logger.error('[MCP Chrome] Error stopping server:', error.message);
            throw error;
        }
    }

    /**
     * Get server status
     */
    getStatus() {
        return {
            running: this.isRunning,
            host: this.host,
            port: this.port,
            extensionConnected: this.extensionConnected,
            transports: this.transportsMap.size,
            tools: Array.from(this.toolHandlers.keys()),
            url: `http://${this.host}:${this.port}/mcp`
        };
    }
}

let serverInstance = null;

/**
 * Get MCP Chrome Server singleton instance
 * @param {Object} options - Server options
 * @returns {MCPChromeServer}
 */
function getInstance(options = {}) {
    if (!serverInstance) {
        serverInstance = new MCPChromeServer(options);
    }
    return serverInstance;
}

module.exports = {
    MCPChromeServer,
    getInstance,
    TOOL_NAMES
};
