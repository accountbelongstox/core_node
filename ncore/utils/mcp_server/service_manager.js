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
const HTTPServiceAdapter = require('./adapters/http_adapter');
const ModuleServiceAdapter = require('./adapters/module_adapter');

/**
 * Service Manager
 * Manages all MCP service instances
 */
class ServiceManager {
    constructor() {
        this.services = new Map();
        this.adapters = new Map();

        this.registerDefaultAdapters();
    }

    /**
     * Register default service adapters
     */
    registerDefaultAdapters() {
        this.adapters.set('http', HTTPServiceAdapter);
        this.adapters.set('module', ModuleServiceAdapter);
    }

    /**
     * Register custom adapter
     * @param {string} type
     * @param {Class} AdapterClass
     */
    registerAdapter(type, AdapterClass) {
        this.adapters.set(type, AdapterClass);
        logger.info(`[MCP Server] Registered adapter: ${type}`);
    }

    /**
     * Initialize service
     * @param {string} serviceName
     * @param {Object} serviceConfig
     * @returns {Promise<boolean>}
     */
    async initializeService(serviceName, serviceConfig) {
        if (!serviceConfig.enabled) {
            logger.info(`[MCP Server] Service '${serviceName}' is disabled`);
            return false;
        }

        const AdapterClass = this.adapters.get(serviceConfig.type);

        if (!AdapterClass) {
            logger.error(`[MCP Server] Unknown service type '${serviceConfig.type}' for '${serviceName}'`);
            return false;
        }

        try {
            const adapter = new AdapterClass(serviceName, serviceConfig);
            const connected = await adapter.connect();

            if (!connected) {
                logger.error(`[MCP Server] Failed to connect service '${serviceName}'`);
                return false;
            }

            this.services.set(serviceName, { adapter, config: serviceConfig });
            logger.info(`[MCP Server] Service '${serviceName}' initialized successfully`);
            return true;

        } catch (error) {
            logger.error(`[MCP Server] Error initializing service '${serviceName}':`, error.message);
            return false;
        }
    }

    /**
     * Get service
     * @param {string} serviceName
     * @returns {Promise<Object|null>}
     */
    async getService(serviceName) {
        let serviceInfo = this.services.get(serviceName);

        if (serviceInfo) {
            const isAlive = await serviceInfo.adapter.ping();

            if (isAlive) {
                return serviceInfo.adapter;
            }

            logger.info(`[MCP Server] Service '${serviceName}' is dead, removing...`);
            this.services.delete(serviceName);
        }

        return null;
    }

    /**
     * Ensure service is available
     * @param {string} serviceName
     * @param {Object} serviceConfig
     * @returns {Promise<Object|null>}
     */
    async ensureService(serviceName, serviceConfig) {
        const service = await this.getService(serviceName);

        if (service) {
            return service;
        }

        const initialized = await this.initializeService(serviceName, serviceConfig);

        if (!initialized) {
            return null;
        }

        return await this.getService(serviceName);
    }

    /**
     * Get all tools from all services
     * @param {Object} config
     * @returns {Promise<Array>}
     */
    async getAllTools(config) {
        const allTools = [];
        const errors = [];

        for (const [serviceName, serviceConfig] of Object.entries(config.services || {})) {
            if (!serviceConfig.enabled) {
                continue;
            }

            try {
                const adapter = await this.ensureService(serviceName, serviceConfig);

                if (!adapter) {
                    errors.push({ service: serviceName, error: 'Service not available' });
                    continue;
                }

                const result = await adapter.listTools();

                for (const tool of result.tools || []) {
                    allTools.push({
                        ...tool,
                        name: `${serviceName}__${tool.name}`,
                        _service: serviceName,
                        _originalName: tool.name,
                        description: `[${serviceName}] ${tool.description}`
                    });
                }

                logger.info(`[MCP Server] Loaded ${result.tools.length} tools from '${serviceName}'`);

            } catch (error) {
                logger.error(`[MCP Server] Failed to load tools from '${serviceName}':`, error.message);
                errors.push({ service: serviceName, error: error.message });
            }
        }

        if (errors.length > 0 && allTools.length === 0) {
            logger.error('[MCP Server] All services failed to load');
        }

        return allTools;
    }

    /**
     * Call tool on service
     * @param {string} serviceName
     * @param {string} toolName
     * @param {Object} args
     * @param {Object} serviceConfig
     * @returns {Promise<Object>}
     */
    async callTool(serviceName, toolName, args, serviceConfig) {
        try {
            const adapter = await this.ensureService(serviceName, serviceConfig);

            if (!adapter) {
                logger.error(`[MCP Server] Service '${serviceName}' not available`);
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: false,
                            error: `Service '${serviceName}' not available`,
                            instructions: [
                                'Check service configuration',
                                'Verify service is running',
                                'Review logs for errors'
                            ]
                        }, null, 2)
                    }],
                    isError: true
                };
            }

            const result = await adapter.callTool(toolName, args);
            logger.info(`[MCP Server] Tool call successful: ${serviceName}::${toolName}`);
            return result;

        } catch (error) {
            logger.error(`[MCP Server] Tool call error (${serviceName}::${toolName}):`, error.message);
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: false,
                        error: error.message,
                        service: serviceName,
                        tool: toolName
                    }, null, 2)
                }],
                isError: true
            };
        }
    }

    /**
     * Close all services
     * @returns {Promise<void>}
     */
    async closeAll() {
        logger.info('[MCP Server] Closing all services...');

        for (const [serviceName, serviceInfo] of this.services.entries()) {
            try {
                await serviceInfo.adapter.close();
                logger.info(`[MCP Server] Closed service '${serviceName}'`);
            } catch (error) {
                logger.error(`[MCP Server] Error closing '${serviceName}':`, error.message);
            }
        }

        this.services.clear();
        logger.info('[MCP Server] All services closed');
    }

    /**
     * Get service count
     * @returns {number}
     */
    getServiceCount() {
        return this.services.size;
    }

    /**
     * Get service names
     * @returns {Array<string>}
     */
    getServiceNames() {
        return Array.from(this.services.keys());
    }
}

module.exports = ServiceManager;
