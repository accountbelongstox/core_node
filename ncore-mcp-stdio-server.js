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
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ListPromptsRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');
const path = require('path');
const fs = require('fs');

/**
 * ncore Universal MCP STDIO Server
 *
 * This is the main STDIO entry point for all ncore MCP services.
 * It aggregates multiple MCP tool services into a unified interface.
 *
 * Supported Services:
 * - mcp-chrome: Browser automation tools (28+ tools)
 * - [Future services can be added here]
 *
 * Usage in Claude Desktop config:
 * {
 *   "mcpServers": {
 *     "ncore-mcp": {
 *       "command": "node",
 *       "args": ["D:\\programing\\core_node\\ncore\\mcp-stdio-server.js"]
 *     }
 *   }
 * }
 */

let stdioServer = null;
let serviceClients = new Map();
let isShuttingDown = false;

const DEFAULT_CONFIG_PATH = path.join(__dirname, 'ncore', 'mcp-stdio-config.json');
const TOOL_CALL_TIMEOUT = 120000;

/**
 * Load configuration
 */
function loadConfig() {
    try {
        if (fs.existsSync(DEFAULT_CONFIG_PATH)) {
            const configData = fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf8');
            const config = JSON.parse(configData);
            console.error('[ncore MCP STDIO] Loaded config:', JSON.stringify(config, null, 2));
            return config;
        }
    } catch (error) {
        console.error('[ncore MCP STDIO] Failed to load config:', error.message);
    }

    return {
        services: {
            'mcp-chrome': {
                enabled: true,
                type: 'http',
                url: 'http://127.0.0.1:12306/mcp',
                description: 'Chrome browser automation tools'
            }
        }
    };
}

/**
 * Initialize service client
 */
async function initializeServiceClient(serviceName, serviceConfig) {
    if (!serviceConfig.enabled) {
        console.error(`[ncore MCP STDIO] Service '${serviceName}' is disabled`);
        return null;
    }

    try {
        if (serviceConfig.type === 'http') {
            const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
            const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

            const client = new Client(
                { name: `ncore-stdio-${serviceName}`, version: '1.0.0' },
                { capabilities: {} }
            );

            const transport = new StreamableHTTPClientTransport(new URL(serviceConfig.url), {});
            await client.connect(transport);

            console.error(`[ncore MCP STDIO] Connected to '${serviceName}' at ${serviceConfig.url}`);
            return { client, config: serviceConfig };

        } else if (serviceConfig.type === 'module') {
            const modulePath = path.resolve(__dirname, serviceConfig.module);
            const serviceModule = require(modulePath);

            if (serviceModule.createClient) {
                const client = await serviceModule.createClient(serviceConfig);
                console.error(`[ncore MCP STDIO] Initialized module service '${serviceName}'`);
                return { client, config: serviceConfig };
            }
        }

        throw new Error(`Unsupported service type: ${serviceConfig.type}`);

    } catch (error) {
        console.error(`[ncore MCP STDIO] Failed to initialize service '${serviceName}':`, error.message);
        return null;
    }
}

/**
 * Ensure service client is connected
 */
async function ensureServiceClient(serviceName) {
    let serviceInfo = serviceClients.get(serviceName);

    if (serviceInfo?.client) {
        try {
            await serviceInfo.client.ping();
            return serviceInfo.client;
        } catch (error) {
            console.error(`[ncore MCP STDIO] Service '${serviceName}' ping failed, reconnecting...`);
            serviceClients.delete(serviceName);
        }
    }

    const config = loadConfig();
    const serviceConfig = config.services[serviceName];

    if (!serviceConfig) {
        throw new Error(`Service '${serviceName}' not found in configuration`);
    }

    serviceInfo = await initializeServiceClient(serviceName, serviceConfig);

    if (!serviceInfo) {
        throw new Error(`Failed to initialize service '${serviceName}'`);
    }

    serviceClients.set(serviceName, serviceInfo);
    return serviceInfo.client;
}

/**
 * Get all available tools from all services
 */
async function getAllTools() {
    const config = loadConfig();
    const allTools = [];
    const serviceErrors = [];

    for (const [serviceName, serviceConfig] of Object.entries(config.services)) {
        if (!serviceConfig.enabled) {
            continue;
        }

        try {
            const client = await ensureServiceClient(serviceName);
            const result = await client.listTools();

            for (const tool of result.tools) {
                allTools.push({
                    ...tool,
                    name: `${serviceName}__${tool.name}`,
                    _service: serviceName,
                    _originalName: tool.name,
                    description: `[${serviceName}] ${tool.description}`
                });
            }

            console.error(`[ncore MCP STDIO] Loaded ${result.tools.length} tools from '${serviceName}'`);

        } catch (error) {
            console.error(`[ncore MCP STDIO] Failed to load tools from '${serviceName}':`, error.message);
            serviceErrors.push({ service: serviceName, error: error.message });
        }
    }

    if (serviceErrors.length > 0 && allTools.length === 0) {
        allTools.push({
            name: 'ncore_connection_error',
            description: 'Error: Cannot connect to ncore services. Check that ncore is running.',
            inputSchema: {
                type: 'object',
                properties: {
                    errors: {
                        type: 'string',
                        description: JSON.stringify(serviceErrors, null, 2)
                    }
                },
                required: []
            }
        });
    }

    return allTools;
}

/**
 * Call tool on specific service
 */
async function callServiceTool(serviceName, toolName, args) {
    try {
        const client = await ensureServiceClient(serviceName);

        const result = await client.callTool(
            { name: toolName, arguments: args || {} },
            undefined,
            { timeout: TOOL_CALL_TIMEOUT }
        );

        console.error(`[ncore MCP STDIO] Tool call successful: ${serviceName}::${toolName}`);
        return result;

    } catch (error) {
        console.error(`[ncore MCP STDIO] Tool call failed (${serviceName}::${toolName}):`, error.message);

        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    success: false,
                    error: error.message,
                    service: serviceName,
                    tool: toolName,
                    instructions: [
                        'Make sure ncore is running: node ncore_module_caller.js',
                        `Check service '${serviceName}' is available`,
                        'Verify all required services are started'
                    ]
                }, null, 2)
            }],
            isError: true
        };
    }
}

/**
 * Setup STDIO server handlers
 */
function setupHandlers(server) {
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        console.error('[ncore MCP STDIO] ListTools request received');

        try {
            const tools = await getAllTools();
            console.error(`[ncore MCP STDIO] Total tools available: ${tools.length}`);
            return { tools };

        } catch (error) {
            console.error('[ncore MCP STDIO] Failed to list tools:', error.message);

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

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;

        console.error(`[ncore MCP STDIO] CallTool request: ${name}`);

        if (name.includes('__')) {
            const [serviceName, ...toolNameParts] = name.split('__');
            const toolName = toolNameParts.join('__');

            return await callServiceTool(serviceName, toolName, args);
        } else {
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
    });

    server.setRequestHandler(ListResourcesRequestSchema, async () => {
        console.error('[ncore MCP STDIO] ListResources request received');
        return { resources: [] };
    });

    server.setRequestHandler(ListPromptsRequestSchema, async () => {
        console.error('[ncore MCP STDIO] ListPrompts request received');
        return { prompts: [] };
    });
}

/**
 * Main entry point
 */
async function main() {
    try {
        console.error('[ncore MCP STDIO] Starting ncore Universal MCP STDIO Server...');

        const config = loadConfig();
        const enabledServices = Object.entries(config.services)
            .filter(([, cfg]) => cfg.enabled)
            .map(([name]) => name);

        console.error('[ncore MCP STDIO] Enabled services:', enabledServices.join(', '));

        stdioServer = new Server(
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

        setupHandlers(stdioServer);

        const transport = new StdioServerTransport();
        await stdioServer.connect(transport);

        console.error('[ncore MCP STDIO] Server started successfully');
        console.error('[ncore MCP STDIO] Aggregating tools from multiple services...');
        console.error('[ncore MCP STDIO] Waiting for requests from Claude Desktop...');

    } catch (error) {
        console.error('[ncore MCP STDIO] Failed to start server:', error);
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
    console.error('[ncore MCP STDIO] Shutting down...');

    try {
        for (const [serviceName, serviceInfo] of serviceClients.entries()) {
            try {
                if (serviceInfo.client?.close) {
                    await serviceInfo.client.close();
                }
                console.error(`[ncore MCP STDIO] Closed connection to '${serviceName}'`);
            } catch (error) {
                console.error(`[ncore MCP STDIO] Error closing '${serviceName}':`, error.message);
            }
        }

        serviceClients.clear();

        if (stdioServer) {
            await stdioServer.close();
        }

        console.error('[ncore MCP STDIO] Shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('[ncore MCP STDIO] Error during shutdown:', error);
        process.exit(1);
    }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('uncaughtException', (error) => {
    console.error('[ncore MCP STDIO] Uncaught exception:', error);
    shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[ncore MCP STDIO] Unhandled rejection:', reason);
    shutdown();
});

if (require.main === module) {
    main().catch((error) => {
        console.error('[ncore MCP STDIO] Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { main };
