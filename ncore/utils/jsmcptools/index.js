'use strict';

const { getInstance: getServer } = require('./server');
const { TOOL_NAMES, MCP_CHROME_PORT } = require('./tool_schemas');
const logger = require('#@logger');

/**
 * MCP Chrome Integration
 * Main entry point for Chrome MCP server integration
 */

/**
 * Start MCP Chrome Server
 * @param {Object} options - Server options
 * @param {number} options.port - Server port from the service contract
 * @param {string} options.host - Server host (default: '127.0.0.1')
 * @param {boolean} options.registerDefaultTools - Register default tools (default: false, requires Chrome extension)
 * @returns {Promise<Object>} Server instance
 */
async function startMCPChromeServer(options = {}) {
    const server = getServer(options);

    if (options.registerDefaultTools) {
        logger.info('[MCP Chrome] Note: Default tools require Chrome extension connection');
    }

    await server.start();

    return server;
}

/**
 * Stop MCP Chrome Server
 */
async function stopMCPChromeServer() {
    const server = getServer();
    await server.stop();
}

/**
 * Get MCP Chrome Server instance
 */
function getMCPChromeServer() {
    return getServer();
}

/**
 * Register custom tool handler
 * @param {string} toolName - Tool name
 * @param {Object} handler - Handler with execute() and getTool() methods
 */
function registerTool(toolName, handler) {
    const server = getServer();
    server.registerTool(toolName, handler);
}

/**
 * Get server status
 */
function getStatus() {
    const server = getServer();
    return server.getStatus();
}

module.exports = {
    startMCPChromeServer,
    stopMCPChromeServer,
    getMCPChromeServer,
    registerTool,
    getStatus,
    TOOL_NAMES,
    MCP_CHROME_PORT
};
