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
            throw new Error('Invalid configuration');
        }

        if (validation.warnings.length > 0) {
            logger.warn('Configuration warnings:');
            validation.warnings.forEach(warning => logger.warn(`  - ${warning}`));
        }
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
                    const error = new Error('Another instance is already running. Only one instance is allowed.');
                    logger.error(error.message);

                    const status = this.singleInstance.getStatus();
                    if (status.existingInstance) {
                        logger.error(`Existing instance: PID ${status.existingInstance.pid}, Uptime: ${Math.round(status.existingInstance.uptime / 1000)}s`);
                    }

                    throw error;
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
            throw error;
        }
    }

    /**
     * Start application in CLI mode
     * @returns {Promise<*>} Result from CLI runner
     */
    async startCLIMode() {
        logger.info('Starting in CLI mode...');

        if (!this.cliRunner || typeof this.cliRunner !== 'function') {
            const error = new Error('CLI runner function not provided');
            logger.error(error.message);
            throw error;
        }

        try {
            const result = await this.cliRunner();
            logger.info('CLI mode completed successfully');
            return result;

        } catch (error) {
            logger.error('CLI mode failed:', error.message);
            throw error;
        }
    }

    /**
     * Setup cleanup handlers for graceful shutdown
     * @private
     */
    setupCleanupHandlers() {
        const cleanupHandler = async (signal) => {
            logger.info(`Received ${signal}, cleaning up...`);

            if (this.mcpServer && this.mcpServer.isRunning()) {
                await this.mcpServer.shutdown();
            }

            if (this.singleInstance) {
                this.singleInstance.shutdown();
            }

            process.exit(0);
        };

        process.on('SIGINT', cleanupHandler);
        process.on('SIGTERM', cleanupHandler);

        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception:', error.message);

            const cleanup = async () => {
                if (this.mcpServer && this.mcpServer.isRunning()) {
                    await this.mcpServer.shutdown();
                }

                if (this.singleInstance) {
                    this.singleInstance.shutdown();
                }

                process.exit(1);
            };

            cleanup();
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled rejection:', reason);
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
            this.validateConfig();

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
            throw error;
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
