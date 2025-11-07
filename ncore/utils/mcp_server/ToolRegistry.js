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
const { EventEmitter } = require('events');

/**
 * Tool Registry for MCP Server
 * Manages registration and execution of MCP tools
 *
 * @class ToolRegistry
 * @extends EventEmitter
 */
class ToolRegistry extends EventEmitter {
    constructor() {
        super();
        this.tools = new Map();
        this.toolInstances = new Map();
        this.toolMetadata = new Map();
        this.executionStats = new Map();
    }

    /**
     * Register a tool instance
     * @param {Object} toolInstance - Tool instance with getTools() and executeTool() methods
     */
    register(toolInstance) {
        if (!toolInstance) {
            throw new Error('Tool instance is required');
        }

        if (!toolInstance.getTools || typeof toolInstance.getTools !== 'function') {
            throw new Error('Tool instance must implement getTools() method');
        }

        if (!toolInstance.executeTool || typeof toolInstance.executeTool !== 'function') {
            throw new Error('Tool instance must implement executeTool() method');
        }

        const tools = toolInstance.getTools();

        if (!Array.isArray(tools)) {
            throw new Error('getTools() must return an array');
        }

        const instanceId = toolInstance.constructor.name || `tool_${Date.now()}`;

        for (const tool of tools) {
            if (!tool.name) {
                logger.warn(`Skipping tool without name from ${instanceId}`);
                continue;
            }

            if (this.tools.has(tool.name)) {
                logger.warn(`Tool ${tool.name} already registered, overwriting`);
            }

            this.tools.set(tool.name, tool);
            this.toolInstances.set(tool.name, toolInstance);

            this.toolMetadata.set(tool.name, {
                instanceId: instanceId,
                registeredAt: Date.now(),
                version: tool.version || '1.0.0',
                category: tool.category || 'general'
            });

            this.executionStats.set(tool.name, {
                callCount: 0,
                successCount: 0,
                errorCount: 0,
                totalExecutionTime: 0,
                lastExecutedAt: null
            });

            logger.info(`Tool registered: ${tool.name} (${instanceId})`);
            this.emit('tool:registered', { toolName: tool.name, instanceId });
        }
    }

    /**
     * Unregister a tool by name
     * @param {string} toolName - Name of the tool to unregister
     */
    unregister(toolName) {
        if (this.tools.has(toolName)) {
            this.tools.delete(toolName);
            this.toolInstances.delete(toolName);
            this.toolMetadata.delete(toolName);
            this.executionStats.delete(toolName);

            logger.info(`Tool unregistered: ${toolName}`);
            this.emit('tool:unregistered', { toolName });
        } else {
            logger.debug(`Tool ${toolName} not found for unregistration`);
        }
    }

    /**
     * Get all registered tools
     * @returns {Array} Array of tool definitions
     */
    getTools() {
        return Array.from(this.tools.values());
    }

    /**
     * Get a specific tool definition
     * @param {string} toolName - Name of the tool
     * @returns {Object|null} Tool definition or null
     */
    getTool(toolName) {
        return this.tools.get(toolName) || null;
    }

    /**
     * Get tool metadata
     * @param {string} toolName - Name of the tool
     * @returns {Object|null} Tool metadata or null
     */
    getToolMetadata(toolName) {
        return this.toolMetadata.get(toolName) || null;
    }

    /**
     * Execute a tool
     * @param {string} toolName - Name of the tool to execute
     * @param {Object} args - Tool arguments
     * @returns {Promise<*>} Tool execution result
     */
    async executeTool(toolName, args = {}) {
        const toolInstance = this.toolInstances.get(toolName);

        if (!toolInstance) {
            const error = new Error(`Tool not found: ${toolName}`);
            logger.error(error.message);
            throw error;
        }

        const stats = this.executionStats.get(toolName);
        stats.callCount++;
        stats.lastExecutedAt = Date.now();

        const startTime = Date.now();

        try {
            logger.debug(`Executing tool: ${toolName}`);
            this.emit('tool:executing', { toolName, args });

            const result = await toolInstance.executeTool(toolName, args);

            const executionTime = Date.now() - startTime;
            stats.successCount++;
            stats.totalExecutionTime += executionTime;

            logger.debug(`Tool executed successfully: ${toolName} (${executionTime}ms)`);
            this.emit('tool:executed', { toolName, executionTime, success: true });

            return result;

        } catch (error) {
            const executionTime = Date.now() - startTime;
            stats.errorCount++;
            stats.totalExecutionTime += executionTime;

            logger.error(`Tool execution failed: ${toolName} - ${error.message}`);
            this.emit('tool:error', { toolName, error: error.message, executionTime });

            throw error;
        }
    }

    /**
     * Check if a tool is registered
     * @param {string} toolName - Name of the tool
     * @returns {boolean} True if tool is registered
     */
    hasTool(toolName) {
        return this.tools.has(toolName);
    }

    /**
     * Get tool count
     * @returns {number} Number of registered tools
     */
    getToolCount() {
        return this.tools.size;
    }

    /**
     * Clear all tools
     */
    clearAllTools() {
        const count = this.tools.size;

        this.tools.clear();
        this.toolInstances.clear();
        this.toolMetadata.clear();
        this.executionStats.clear();

        logger.info(`Cleared all ${count} tools`);
        this.emit('tools:cleared', { clearedCount: count });
    }

    /**
     * Get execution statistics for a tool
     * @param {string} toolName - Name of the tool
     * @returns {Object|null} Execution statistics or null
     */
    getToolStats(toolName) {
        const stats = this.executionStats.get(toolName);

        if (!stats) {
            return null;
        }

        const avgExecutionTime = stats.callCount > 0
            ? stats.totalExecutionTime / stats.callCount
            : 0;

        return {
            ...stats,
            averageExecutionTime: avgExecutionTime,
            successRate: stats.callCount > 0
                ? (stats.successCount / stats.callCount) * 100
                : 0
        };
    }

    /**
     * Get registry statistics
     * @returns {Object} Registry statistics
     */
    getStats() {
        const toolNames = Array.from(this.tools.keys());
        const toolStats = {};

        for (const toolName of toolNames) {
            toolStats[toolName] = this.getToolStats(toolName);
        }

        return {
            totalTools: this.tools.size,
            tools: toolNames,
            toolStats: toolStats,
            categories: this.getToolCategories()
        };
    }

    /**
     * Get tools grouped by category
     * @returns {Object} Tools grouped by category
     */
    getToolCategories() {
        const categories = {};

        for (const [toolName, metadata] of this.toolMetadata.entries()) {
            const category = metadata.category || 'general';

            if (!categories[category]) {
                categories[category] = [];
            }

            categories[category].push(toolName);
        }

        return categories;
    }

    /**
     * Get tools by category
     * @param {string} category - Category name
     * @returns {Array} Array of tool names in the category
     */
    getToolsByCategory(category) {
        const tools = [];

        for (const [toolName, metadata] of this.toolMetadata.entries()) {
            if (metadata.category === category) {
                tools.push(toolName);
            }
        }

        return tools;
    }

    /**
     * Search tools by name pattern
     * @param {string} pattern - Search pattern (regex string)
     * @returns {Array} Array of matching tool names
     */
    searchTools(pattern) {
        const regex = new RegExp(pattern, 'i');
        const matchingTools = [];

        for (const toolName of this.tools.keys()) {
            if (regex.test(toolName)) {
                matchingTools.push(toolName);
            }
        }

        return matchingTools;
    }
}

module.exports = ToolRegistry;
