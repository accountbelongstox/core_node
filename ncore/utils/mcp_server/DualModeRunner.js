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
const MCPConfig = require('./config/mcp_config');
const MCPServerManager = require('./MCPServerManager');
const SingleInstanceManager = require('./SingleInstanceManager');
const { getThreadBus } = require('#@thread_bus');

/**
 * Dual Mode Runner
 * Manages running application in either MCP mode or CLI mode
 * Detects mode automatically and delegates execution
 *
 * @class DualModeRunner
 */
class DualModeRunner {
    constructor(options = {}) {
        this.config = MCPConfig.merge(options.mcpConfig || {});
        this.cliRunner = options.cliRunner || null;
        this.mcpServer = null;
        this.singleInstance = null;
        this.mode = null;
        this.initialized = false;
        this.enableSingleInstance = options.enableSingleInstance === true;
    }

    /**
     * Detect running mode based on configuration
     * @returns {string} Detected mode ('mcp' or 'cli')
     */
    detectMode() {
        if (this.config.mode.default === 'cli') {
            return 'cli';
        }

        if (this.config.mode.default === 'mcp') {
            return 'mcp';
        }

        return MCPConfig.isMCPMode(this.config) ? 'mcp' : 'cli';
    }

    /**
     * Validate configuration
     * @private
     */
    validateConfig() {
        const validation = MCPConfig.validate(this.config);

        if (!validation.valid) {
            logger.error('Configuration validation failed:');
            validation.errors.forEach(error => logger.error(`  - ${error}`));
            return false;
        }

        if (validation.warnings.length > 0) {
            logger.warn('Configuration warnings:');
            validation.warnings.forEach(warning => logger.warn(`  - ${warning}`));
        }
        return true;
    }

    /**
     * Start application in MCP mode
     * @returns {Promise<MCPServerManager>} MCP server instance
     */
    async startMCPMode() {
        logger.info('Starting in MCP mode...');

        try {
            if (this.enableSingleInstance) {
                this.singleInstance = new SingleInstanceManager({
                    serverName: this.config.server.name
                });

                if (!this.singleInstance.acquireLock()) {
                    logger.error('Another instance is already running. Only one instance is allowed.');

                    const status = this.singleInstance.getStatus();
                    if (status.existingInstance) {
                        logger.error(`Existing instance: PID ${status.existingInstance.pid}, Uptime: ${Math.round(status.existingInstance.uptime / 1000)}s`);
                    }

                    this.singleInstance = null;
                    return null;
                }

                logger.info('Single instance lock acquired successfully');
            }

            this.mcpServer = new MCPServerManager({
                serverName: this.config.server.name,
                serverVersion: this.config.server.version,
                capabilities: this.config.server.capabilities,
                sessionConfig: this.config.session
            });

            await this.mcpServer.initialize();

            this.setupCleanupHandlers();

            await this.mcpServer.start();

            logger.info('MCP mode started successfully');

            return this.mcpServer;

        } catch (error) {
            if (this.singleInstance) {
                this.singleInstance.shutdown();
            }
            logger.error('Failed to start MCP mode:', error.message);
            return null;
        }
    }

    /**
     * Start application in CLI mode
     * @returns {Promise<*>} Result from CLI runner
     */
    async startCLIMode() {
        logger.info('Starting in CLI mode...');

        if (!this.cliRunner || typeof this.cliRunner !== 'function') {
            logger.error('CLI runner function not provided');
            return null;
        }

        try {
            const result = await this.cliRunner();
            logger.info('CLI mode completed successfully');
            return result;

        } catch (error) {
            logger.error('CLI mode failed:', error.message);
            return null;
        }
    }

    /**
     * Setup cleanup handlers for graceful shutdown
     * @private
     */
    setupCleanupHandlers() {
        // ThreadBus owns SIGINT/SIGTERM/uncaughtException; the single-instance lock registers itself to run last
        getThreadBus().register(`mcp-server:${this.config.server.name}`, {
            onShutdown: async (reason) => {
                logger.info(`Received ${reason}, cleaning up...`);
                if (this.mcpServer && this.mcpServer.isRunning()) {
                    await this.mcpServer.shutdown();
                }
            }
        });
    }

    /**
     * Start application in detected mode
     * @returns {Promise<*>} Server instance or CLI result
     */
    async start() {
        if (this.initialized) {
            logger.warn('DualModeRunner already started');
            return this.mode === 'mcp' ? this.mcpServer : null;
        }

        try {
            if (!this.validateConfig()) {
                return null;
            }

            this.mode = this.detectMode();
            logger.info(`Detected mode: ${this.mode}`);

            this.initialized = true;

            if (this.mode === 'mcp') {
                return await this.startMCPMode();
            } else {
                return await this.startCLIMode();
            }

        } catch (error) {
            logger.error('Failed to start DualModeRunner:', error.message);
            return null;
        }
    }

    /**
     * Get MCP server instance (only available in MCP mode)
     * @returns {MCPServerManager|null} MCP server or null
     */
    getMCPServer() {
        return this.mcpServer;
    }

    /**
     * Get current running mode
     * @returns {string|null} Current mode or null if not started
     */
    getMode() {
        return this.mode;
    }

    /**
     * Check if runner is initialized
     * @returns {boolean} True if initialized
     */
    isInitialized() {
        return this.initialized;
    }

    /**
     * Get runner statistics
     * @returns {Object} Runner statistics
     */
    getStats() {
        const stats = {
            mode: this.mode,
            initialized: this.initialized,
            config: {
                serverName: this.config.server.name,
                serverVersion: this.config.server.version,
                transport: this.config.server.transport
            }
        };

        if (this.mcpServer && this.mode === 'mcp') {
            stats.mcpServer = this.mcpServer.getStats();
        }

        return stats;
    }

    /**
     * Shutdown runner
     * @returns {Promise<void>}
     */
    async shutdown() {
        if (this.mcpServer && this.mcpServer.isRunning()) {
            await this.mcpServer.shutdown();
        }

        if (this.singleInstance) {
            this.singleInstance.shutdown();
        }

        this.initialized = false;
        logger.info('DualModeRunner shutdown complete');
    }
}

module.exports = DualModeRunner;
