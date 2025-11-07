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

/**
 * MCP Server Configuration Manager
 * Provides default configuration and utilities for MCP server setup
 *
 * @class MCPConfig
 */
class MCPConfig {
    /**
     * Get default MCP server configuration
     * @returns {Object} Default configuration object
     */
    static getDefaultConfig() {
        return {
            mode: {
                default: 'auto',
                detection: {
                    args: ['mcp', '--mcp', 'mcp=true'],
                    env: ['MCP_MODE', 'NODE_ENV']
                }
            },
            server: {
                name: 'default_mcp_server',
                version: '1.0.0',
                transport: 'stdio',
                capabilities: {
                    tools: {},
                    resources: {},
                    prompts: {}
                }
            },
            logging: {
                level: 'info',
                stream: 'auto',
                format: 'text',
                colors: true
            },
            session: {
                timeout: 3600000,
                maxSessions: 100,
                cleanupInterval: 300000
            },
            tools: {
                enableStats: true,
                enableMetadata: true,
                defaultCategory: 'general'
            }
        };
    }

    /**
     * Merge custom configuration with defaults
     * @param {Object} customConfig - Custom configuration to merge
     * @returns {Object} Merged configuration
     */
    static merge(customConfig = {}) {
        const defaultConfig = MCPConfig.getDefaultConfig();

        return {
            mode: {
                ...defaultConfig.mode,
                ...(customConfig.mode || {})
            },
            server: {
                ...defaultConfig.server,
                ...(customConfig.server || {}),
                capabilities: {
                    ...defaultConfig.server.capabilities,
                    ...(customConfig.server?.capabilities || {})
                }
            },
            logging: {
                ...defaultConfig.logging,
                ...(customConfig.logging || {})
            },
            session: {
                ...defaultConfig.session,
                ...(customConfig.session || {})
            },
            tools: {
                ...defaultConfig.tools,
                ...(customConfig.tools || {})
            }
        };
    }

    /**
     * Check if running in MCP mode
     * @param {Object} config - Optional config object
     * @returns {boolean} True if in MCP mode
     */
    static isMCPMode(config = null) {
        const detectionConfig = config?.mode?.detection || MCPConfig.getDefaultConfig().mode.detection;

        for (const envVar of detectionConfig.env) {
            const envValue = process.env[envVar];
            if (envValue && envValue.toLowerCase() === 'mcp') {
                return true;
            }
        }

        for (const arg of process.argv) {
            for (const pattern of detectionConfig.args) {
                if (arg.toLowerCase().includes(pattern.toLowerCase())) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Get runtime mode (mcp or cli)
     * @param {Object} config - Optional config object
     * @returns {string} Runtime mode
     */
    static getMode(config = null) {
        const modeConfig = config?.mode || MCPConfig.getDefaultConfig().mode;

        if (modeConfig.default === 'cli') {
            return 'cli';
        }

        if (modeConfig.default === 'mcp') {
            return 'mcp';
        }

        return MCPConfig.isMCPMode(config) ? 'mcp' : 'cli';
    }

    /**
     * Validate configuration
     * @param {Object} config - Configuration to validate
     * @returns {Object} Validation result
     */
    static validate(config) {
        const errors = [];
        const warnings = [];

        if (!config) {
            errors.push('Configuration is required');
            return { valid: false, errors, warnings };
        }

        if (config.server) {
            if (!config.server.name) {
                errors.push('Server name is required');
            }

            if (!config.server.version) {
                warnings.push('Server version not specified, using default');
            }

            if (!config.server.transport) {
                warnings.push('Transport not specified, using default (stdio)');
            } else if (config.server.transport !== 'stdio') {
                warnings.push('Only stdio transport is currently supported');
            }
        }

        if (config.session) {
            if (config.session.timeout && config.session.timeout < 60000) {
                warnings.push('Session timeout is very short (< 1 minute)');
            }

            if (config.session.maxSessions && config.session.maxSessions < 1) {
                errors.push('Max sessions must be at least 1');
            }

            if (config.session.cleanupInterval && config.session.cleanupInterval < 10000) {
                warnings.push('Cleanup interval is very short (< 10 seconds)');
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Create session configuration from main config
     * @param {Object} config - Main configuration
     * @returns {Object} Session configuration
     */
    static getSessionConfig(config) {
        const mergedConfig = MCPConfig.merge(config);
        return mergedConfig.session;
    }

    /**
     * Create logging configuration from main config
     * @param {Object} config - Main configuration
     * @returns {Object} Logging configuration
     */
    static getLoggingConfig(config) {
        const mergedConfig = MCPConfig.merge(config);
        return mergedConfig.logging;
    }

    /**
     * Create tools configuration from main config
     * @param {Object} config - Main configuration
     * @returns {Object} Tools configuration
     */
    static getToolsConfig(config) {
        const mergedConfig = MCPConfig.merge(config);
        return mergedConfig.tools;
    }

    /**
     * Get server info from config
     * @param {Object} config - Main configuration
     * @returns {Object} Server info
     */
    static getServerInfo(config) {
        const mergedConfig = MCPConfig.merge(config);
        return {
            name: mergedConfig.server.name,
            version: mergedConfig.server.version,
            transport: mergedConfig.server.transport,
            capabilities: mergedConfig.server.capabilities
        };
    }
}

module.exports = MCPConfig;
