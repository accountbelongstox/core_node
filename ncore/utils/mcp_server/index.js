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

const MCPServerManager = require('./MCPServerManager');
const SessionManager = require('./SessionManager');
const ToolRegistry = require('./ToolRegistry');
const DualModeRunner = require('./DualModeRunner');
const SingleInstanceManager = require('./SingleInstanceManager');
const MCPConfig = require('./config/mcp_config');
const { start, stop, getServer } = require('./main');
const { getInstance: getConfigLoader } = require('./config_loader');
const ServiceManager = require('./service_manager');
const StdioServer = require('./stdio_server');
const HTTPServiceAdapter = require('./adapters/http_adapter');
const ModuleServiceAdapter = require('./adapters/module_adapter');

/**
 * ncore MCP Server Module
 *
 * This module provides two architectures:
 *
 * 1. Original Architecture (MCPServerManager, ToolRegistry, etc.)
 *    - Single MCP server with tool registration
 *    - Session management and dual mode support
 *    - Use: createMCPServer(), createToolRegistry(), etc.
 *
 * 2. Universal MCP Aggregator (New)
 *    - Aggregates multiple MCP services (HTTP, Module)
 *    - STDIO interface for Claude Desktop
 *    - Service-based architecture with adapters
 *    - Use: start(), stop(), getServer()
 *    - CLI: node ncore/utils/mcp_server/main.js
 */

module.exports = {
    MCPServerManager,
    SessionManager,
    ToolRegistry,
    DualModeRunner,
    SingleInstanceManager,
    MCPConfig,
    start,
    stop,
    getServer,
    getConfigLoader,
    ServiceManager,
    StdioServer,
    HTTPServiceAdapter,
    ModuleServiceAdapter,

    createMCPServer: (options = {}) => {
        return new MCPServerManager(options);
    },

    createDualModeRunner: (options = {}) => {
        return new DualModeRunner(options);
    },

    createSessionManager: (options = {}) => {
        return new SessionManager(options);
    },

    createToolRegistry: () => {
        return new ToolRegistry();
    },

    createSingleInstanceManager: (options = {}) => {
        return new SingleInstanceManager(options);
    },

    isMCPMode: (config = null) => {
        return MCPConfig.isMCPMode(config);
    },

    getDefaultConfig: () => {
        return MCPConfig.getDefaultConfig();
    },

    mergeConfig: (customConfig = {}) => {
        return MCPConfig.merge(customConfig);
    }
};
