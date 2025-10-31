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
const WebAutomationTools = require('./tools/web_automation.js');

let webAutomationTools = null;
let server = null;

async function initializeMCPServer() {
    logger.info('Initializing MCP Server for core_node_init...');

    server = new Server(
        {
            name: 'core_node_init_web_automation',
            version: '1.0.0',
        },
        {
            capabilities: {
                tools: {},
            },
        }
    );

    webAutomationTools = new WebAutomationTools();
    await webAutomationTools.initialize();

    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: webAutomationTools.getTools(),
        };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;

        try {
            const result = await webAutomationTools.executeTool(name, args || {});
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
                        }, null, 2),
                    },
                ],
                isError: true,
            };
        }
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('MCP Server started successfully');

    return server;
}

async function shutdownMCPServer() {
    if (webAutomationTools) {
        await webAutomationTools.cleanup();
    }
    if (server) {
        await server.close();
    }
    logger.info('MCP Server shutdown complete');
}

module.exports = {
    initializeMCPServer,
    shutdownMCPServer
};
