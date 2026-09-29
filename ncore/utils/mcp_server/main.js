#!/usr/bin/env node

'use strict';

const logger = require('#@logger');
const { getThreadBus } = require('#@thread_bus');
const StdioServer = require('./stdio_server');

/**
 * ncore MCP STDIO Server Main Entry
 *
 * This is the CLI entry point for starting the STDIO MCP server
 * from Claude Desktop or command line.
 *
 * Usage: node ncore/utils/mcp_server/main.js
 */

let server = null;

/**
 * Start STDIO server
 * @param {Object} options
 * @returns {Promise<StdioServer>}
 */
async function start(options = {}) {
    if (server) {
        logger.warn('[MCP Server] Server already running');
        return server;
    }

    server = new StdioServer(options);
    await server.start();

    setupSignalHandlers();

    return server;
}

/**
 * Stop STDIO server
 * @returns {Promise<void>}
 */
async function stop() {
    if (!server) {
        logger.warn('[MCP Server] Server not running');
        return;
    }

    await server.stop();
    server = null;
}

/**
 * Get server instance
 * @returns {StdioServer|null}
 */
function getServer() {
    return server;
}

/**
 * Setup signal handlers for graceful shutdown
 */
function setupSignalHandlers() {
    // ThreadBus owns SIGINT/SIGTERM/uncaughtException and awaits this hook before exiting
    getThreadBus().register('mcp-stdio-server', {
        onShutdown: async (reason) => {
            logger.info(`[MCP Server] Received ${reason}`);
            await stop();
        }
    });
}

/**
 * CLI entry point
 */
if (require.main === module) {
    start().catch((error) => {
        logger.error('[MCP Server] Fatal error:', error);
        process.exit(1);
    });
}

module.exports = {
    start,
    stop,
    getServer
};
