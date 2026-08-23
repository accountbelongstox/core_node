#!/usr/bin/env node
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
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ListPromptsRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');
const path = require('path');
const fs = require('fs');
const serviceContract = require('../../../config/service_contract');

/**
 * MCP Chrome STDIO Proxy Server
 *
 * This server acts as a STDIO-to-HTTP proxy:
 * 1. Accepts STDIO connections from Claude Desktop
 * 2. Forwards requests to the configured HTTP MCP server
 * 3. Returns responses back through STDIO
 *
 * Usage in Claude Desktop config:
 * {
 *   "mcpServers": {
 *     "chrome-mcp-ncore": {
 *       "command": "node",
 *       "args": ["D:\\programing\\core_node\\ncore\\utils\\jsmcptools\\mcp-server-stdio.js"]
 *     }
 *   }
 * }
 */

let stdioServer = null;
let httpClient = null;
let isShuttingDown = false;

const DEFAULT_HTTP_URL = serviceContract.url('http', serviceContract.host('loopback'), serviceContract.port('mcp_chrome'), 'mcp');
const TOOL_CALL_TIMEOUT = 120000;

/**
 * Load configuration from stdio-config.json if exists
 */
function loadConfig() {
    try {
        const configPath = path.join(__dirname, 'stdio-config.json');
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configData);
            console.error('[MCP Chrome STDIO] Loaded config:', config);
            return {
                ...config,
                url: config.url || serviceContract.url(
                    'http',
                    serviceContract.host(config.hostKey || 'loopback'),
                    serviceContract.port(config.portKey || 'mcp_chrome'),
                    config.path || 'mcp'
                )
            };
        }
    } catch (error) {
        console.error('[MCP Chrome STDIO] Failed to load stdio-config.json:', error.message);
    }

    return { url: DEFAULT_HTTP_URL };
}

/**
 * Ensure HTTP client is connected
 */
async function ensureHttpClient() {
    if (httpClient) {
        try {
            await httpClient.ping();
            return httpClient;
        } catch (error) {
            console.error('[MCP Chrome STDIO] HTTP client ping failed, reconnecting...');
            httpClient = null;
        }
    }

    const config = loadConfig();
    const url = config.url || DEFAULT_HTTP_URL;

    console.error(`[MCP Chrome STDIO] Connecting to HTTP MCP server: ${url}`);

    try {
        httpClient = new Client(
            { name: 'chrome-mcp-stdio-proxy', version: '1.0.0' },
            { capabilities: {} }
        );

        const transport = new StreamableHTTPClientTransport(new URL(url), {});
        await httpClient.connect(transport);

        console.error('[MCP Chrome STDIO] Connected to HTTP MCP server successfully');
        return httpClient;
    } catch (error) {
        console.error('[MCP Chrome STDIO] Failed to connect to HTTP MCP server:', error.message);
        console.error(`[MCP Chrome STDIO] Make sure ncore HTTP server is running on port ${serviceContract.port('mcp_chrome')}`);

        if (httpClient) {
            await httpClient.close().catch(() => {});
            httpClient = null;
        }

        throw error;
    }
}

/**
 * Setup STDIO server handlers
 */
function setupHandlers(server) {
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        console.error('[MCP Chrome STDIO] ListTools request received');

        try {
            const client = await ensureHttpClient();
            const result = await client.listTools();
            console.error(`[MCP Chrome STDIO] Retrieved ${result.tools.length} tools from HTTP server`);
            return result;
        } catch (error) {
            console.error('[MCP Chrome STDIO] Failed to list tools:', error.message);

            return {
                tools: [{
                    name: 'chrome_connection_error',
                    description: `Error: Cannot connect to HTTP MCP server. Make sure ncore is running with MCP Chrome service on port ${serviceContract.port('mcp_chrome')}.`,
                    inputSchema: {
                        type: 'object',
                        properties: {},
                        required: []
                    }
                }]
            };
        }
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;

        console.error(`[MCP Chrome STDIO] CallTool request: ${name}`);

        try {
            const client = await ensureHttpClient();

            const result = await client.callTool(
                { name, arguments: args || {} },
                undefined,
                { timeout: TOOL_CALL_TIMEOUT }
            );

            console.error(`[MCP Chrome STDIO] Tool call successful: ${name}`);
            return result;

        } catch (error) {
            console.error(`[MCP Chrome STDIO] Tool call failed (${name}):`, error.message);

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: false,
                        error: error.message,
                        tool: name,
                        instructions: [
                            'Make sure ncore is running: node ncore_module_caller.js',
                            `Verify HTTP server is running on port ${serviceContract.port('mcp_chrome')}`,
                            'Check Chrome Extension is loaded and connected'
                        ]
                    }, null, 2)
                }],
                isError: true
            };
        }
    });

    server.setRequestHandler(ListResourcesRequestSchema, async () => {
        console.error('[MCP Chrome STDIO] ListResources request received');

        try {
            const client = await ensureHttpClient();
            return await client.listResources();
        } catch (error) {
            console.error('[MCP Chrome STDIO] Failed to list resources:', error.message);
            return { resources: [] };
        }
    });

    server.setRequestHandler(ListPromptsRequestSchema, async () => {
        console.error('[MCP Chrome STDIO] ListPrompts request received');

        try {
            const client = await ensureHttpClient();
            return await client.listPrompts();
        } catch (error) {
            console.error('[MCP Chrome STDIO] Failed to list prompts:', error.message);
            return { prompts: [] };
        }
    });
}

/**
 * Main entry point
 */
async function main() {
    try {
        console.error('[MCP Chrome STDIO] Starting STDIO MCP server...');

        stdioServer = new Server(
            {
                name: 'chrome-mcp-ncore-stdio',
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

        setupHandlers(stdioServer);

        const transport = new StdioServerTransport();
        await stdioServer.connect(transport);

        console.error('[MCP Chrome STDIO] Server started successfully');
        console.error('[MCP Chrome STDIO] Proxying requests to HTTP server at:', DEFAULT_HTTP_URL);
        console.error('[MCP Chrome STDIO] Waiting for requests from Claude Desktop...');

    } catch (error) {
        console.error('[MCP Chrome STDIO] Failed to start server:', error);
        process.exit(1);
    }
}

/**
 * Graceful shutdown
 */
async function shutdown() {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;
    console.error('[MCP Chrome STDIO] Shutting down...');

    try {
        if (httpClient) {
            await httpClient.close().catch(() => {});
            httpClient = null;
        }

        if (stdioServer) {
            await stdioServer.close().catch(() => {});
            stdioServer = null;
        }

        console.error('[MCP Chrome STDIO] Shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('[MCP Chrome STDIO] Error during shutdown:', error);
        process.exit(1);
    }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('uncaughtException', (error) => {
    console.error('[MCP Chrome STDIO] Uncaught exception:', error);
    shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[MCP Chrome STDIO] Unhandled rejection:', reason);
    shutdown();
});

if (require.main === module) {
    main().catch((error) => {
        console.error('[MCP Chrome STDIO] Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { main };
