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
 * @param {number} options.port - Server port (default: 12306)
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
