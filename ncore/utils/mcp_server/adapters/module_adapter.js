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

const path = require('path');
const logger = require('#@logger');

/**
 * Module Service Adapter
 * Loads local Node.js module as MCP service
 */
class ModuleServiceAdapter {
    constructor(serviceName, config) {
        this.serviceName = serviceName;
        this.config = config;
        this.client = null;
    }

    /**
     * Connect to module service
     * @returns {Promise<boolean>}
     */
    async connect() {
        try {
            const modulePath = path.resolve(process.cwd(), this.config.module);
            const serviceModule = require(modulePath);

            if (!serviceModule.createClient || typeof serviceModule.createClient !== 'function') {
                logger.error(`[MCP Server] Module '${this.serviceName}' missing createClient() function`);
                return false;
            }

            this.client = await serviceModule.createClient(this.config);

            if (!this.client || typeof this.client !== 'object') {
                logger.error(`[MCP Server] Module '${this.serviceName}' createClient() returned invalid client`);
                return false;
            }

            logger.info(`[MCP Server] Loaded module service '${this.serviceName}' from ${modulePath}`);
            return true;

        } catch (error) {
            logger.error(`[MCP Server] Failed to load module service '${this.serviceName}':`, error.message);
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

            if (this.client.ping && typeof this.client.ping === 'function') {
                await this.client.ping();
            }

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
                logger.error(`[MCP Server] Client not initialized for '${this.serviceName}'`);
                return { tools: [] };
            }

            if (!this.client.listTools || typeof this.client.listTools !== 'function') {
                logger.error(`[MCP Server] Module '${this.serviceName}' missing listTools() method`);
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
                logger.error(`[MCP Server] Client not initialized for '${this.serviceName}'`);
                return {
                    content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Client not initialized' }) }],
                    isError: true
                };
            }

            if (!this.client.callTool || typeof this.client.callTool !== 'function') {
                logger.error(`[MCP Server] Module '${this.serviceName}' missing callTool() method`);
                return {
                    content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'callTool not implemented' }) }],
                    isError: true
                };
            }

            const result = await this.client.callTool({ name: toolName, arguments: args || {} });
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
            if (this.client && this.client.close && typeof this.client.close === 'function') {
                await this.client.close();
            }
            this.client = null;
            logger.info(`[MCP Server] Closed module service '${this.serviceName}'`);
        } catch (error) {
            logger.error(`[MCP Server] Error closing '${this.serviceName}':`, error.message);
        }
    }
}

module.exports = ModuleServiceAdapter;
