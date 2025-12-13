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
const freader = require('#@freader');
const fwriter = require('#@fwriter');
const globalVars = require('#@global_vars');
const logger = require('#@logger');

const DEFAULT_CONFIG_FILENAME = 'mcp-stdio-config.json';

/**
 * Config Loader for MCP STDIO Server
 * Manages configuration loading, validation, and defaults
 */
class ConfigLoader {
    constructor() {
        this.configPath = path.join(
            globalVars.APP_RUNTIME_CACHE_DIR || path.join(process.cwd(), '.cache'),
            DEFAULT_CONFIG_FILENAME
        );
    }

    /**
     * Load configuration from file
     * @returns {Promise<Object>}
     */
    async loadConfig() {
        try {
            const exists = await freader.exists(this.configPath);

            if (exists) {
                const content = await freader.readFileContent(this.configPath);
                const config = JSON.parse(content);
                logger.info('[MCP Server] Config loaded from:', this.configPath);
                return config;
            }

            logger.info('[MCP Server] Config file not found, using defaults');
            return this.getDefaultConfig();

        } catch (error) {
            logger.error('[MCP Server] Failed to load config:', error.message);
            return this.getDefaultConfig();
        }
    }

    /**
     * Get default configuration
     * @returns {Object}
     */
    getDefaultConfig() {
        return {
            services: {
                'mcp-chrome': {
                    enabled: true,
                    type: 'http',
                    url: 'http://127.0.0.1:12306/mcp',
                    description: 'Chrome browser automation tools'
                }
            }
        };
    }

    /**
     * Save configuration to file
     * @param {Object} config
     * @returns {Promise<boolean>}
     */
    async saveConfig(config) {
        try {
            const content = JSON.stringify(config, null, 2);
            await fwriter.writeFileContent(this.configPath, content);
            logger.info('[MCP Server] Config saved to:', this.configPath);
            return true;
        } catch (error) {
            logger.error('[MCP Server] Failed to save config:', error.message);
            return false;
        }
    }

    /**
     * Validate configuration
     * @param {Object} config
     * @returns {boolean}
     */
    validateConfig(config) {
        if (!config || typeof config !== 'object') {
            logger.error('[MCP Server] Config must be an object');
            return false;
        }

        if (!config.services || typeof config.services !== 'object') {
            logger.error('[MCP Server] Config must have services object');
            return false;
        }

        for (const [serviceName, serviceConfig] of Object.entries(config.services)) {
            if (!serviceConfig.type) {
                logger.error(`[MCP Server] Service '${serviceName}' missing type`);
                return false;
            }

            if (!['http', 'module'].includes(serviceConfig.type)) {
                logger.error(`[MCP Server] Service '${serviceName}' has invalid type: ${serviceConfig.type}`);
                return false;
            }

            if (serviceConfig.type === 'http' && !serviceConfig.url) {
                logger.error(`[MCP Server] HTTP service '${serviceName}' missing url`);
                return false;
            }

            if (serviceConfig.type === 'module' && !serviceConfig.module) {
                logger.error(`[MCP Server] Module service '${serviceName}' missing module path`);
                return false;
            }
        }

        return true;
    }

    /**
     * Get config file path
     * @returns {string}
     */
    getConfigPath() {
        return this.configPath;
    }
}

let instance = null;

/**
 * Get ConfigLoader singleton instance
 * @returns {ConfigLoader}
 */
function getInstance() {
    if (!instance) {
        instance = new ConfigLoader();
    }
    return instance;
}

module.exports = {
    ConfigLoader,
    getInstance
};
