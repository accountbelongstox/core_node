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

const logger = require('#@logger');
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
    process.on('SIGINT', async () => {
        logger.info('[MCP Server] Received SIGINT');
        await stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        logger.info('[MCP Server] Received SIGTERM');
        await stop();
        process.exit(0);
    });

    process.on('uncaughtException', (error) => {
        logger.error('[MCP Server] Uncaught exception:', error);
        stop().then(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason) => {
        logger.error('[MCP Server] Unhandled rejection:', reason);
        stop().then(() => process.exit(1));
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
