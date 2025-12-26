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

const logger = require('#@logger');

/**
 * HTTP Service Adapter
 * Connects to external MCP HTTP server
 */
class HTTPServiceAdapter {
    constructor(serviceName, config) {
        this.serviceName = serviceName;
        this.config = config;
        this.client = null;
    }

    /**
     * Connect to HTTP service
     * @returns {Promise<boolean>}
     */
    async connect() {
        try {
            const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
            const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

            this.client = new Client(
                { name: `ncore-mcp-${this.serviceName}`, version: '1.0.0' },
                { capabilities: {} }
            );

            const transport = new StreamableHTTPClientTransport(new URL(this.config.url), {});
            await this.client.connect(transport);

            logger.info(`[MCP Server] Connected to HTTP service '${this.serviceName}' at ${this.config.url}`);
            return true;

        } catch (error) {
            logger.error(`[MCP Server] Failed to connect to HTTP service '${this.serviceName}':`, error.message);
            return false;
        }
    }

    /**
     * Ping service
     * @returns {Promise<boolean>}
     */
    async ping() {
        try {
            if (!this.client) {
                return false;
            }
            await this.client.ping();
            return true;
        } catch (error) {
            logger.error(`[MCP Server] Ping failed for '${this.serviceName}':`, error.message);
            return false;
        }
    }

    /**
     * List tools
     * @returns {Promise<Object>}
     */
    async listTools() {
        try {
            if (!this.client) {
                logger.error(`[MCP Server] Client not connected for '${this.serviceName}'`);
                return { tools: [] };
            }

            const result = await this.client.listTools();
            return result;

        } catch (error) {
            logger.error(`[MCP Server] Failed to list tools from '${this.serviceName}':`, error.message);
            return { tools: [] };
        }
    }

    /**
     * Call tool
     * @param {string} toolName
     * @param {Object} args
     * @param {number} timeout
     * @returns {Promise<Object>}
     */
    async callTool(toolName, args, timeout = 120000) {
        try {
            if (!this.client) {
                logger.error(`[MCP Server] Client not connected for '${this.serviceName}'`);
                return {
                    content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Client not connected' }) }],
                    isError: true
                };
            }

            const result = await this.client.callTool(
                { name: toolName, arguments: args || {} },
                undefined,
                { timeout }
            );

            return result;

        } catch (error) {
            logger.error(`[MCP Server] Tool call failed (${this.serviceName}::${toolName}):`, error.message);
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }],
                isError: true
            };
        }
    }

    /**
     * Close connection
     * @returns {Promise<void>}
     */
    async close() {
        try {
            if (this.client) {
                await this.client.close();
                this.client = null;
                logger.info(`[MCP Server] Closed connection to '${this.serviceName}'`);
            }
        } catch (error) {
            logger.error(`[MCP Server] Error closing '${this.serviceName}':`, error.message);
        }
    }
}

module.exports = HTTPServiceAdapter;
