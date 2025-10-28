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

// Declare variables
let pluginCounter = 0;

class SpiderPluginManager {
    constructor(plugins = []) {
        this.plugins = new Map();
        this.spider = null;
        this.isInitialized = false;
        
        // Load initial plugins
        plugins.forEach(plugin => this.addPlugin(plugin));
    }

    addPlugin(plugin) {
        try {
            const pluginId = plugin.id || `plugin_${++pluginCounter}`;
            
            // Validate plugin structure
            if (!plugin.name || typeof plugin.initialize !== 'function') {
                throw new Error('Invalid plugin structure. Plugin must have name and initialize method.');
            }
            
            this.plugins.set(pluginId, {
                id: pluginId,
                name: plugin.name,
                version: plugin.version || '1.0.0',
                instance: plugin,
                isActive: false,
                createdAt: new Date().toISOString()
            });
            
            logger.info(`Plugin added: ${plugin.name} (${pluginId})`);
            
            // Initialize plugin if spider is already initialized
            if (this.isInitialized && this.spider) {
                this.initializePlugin(pluginId);
            }
            
            return pluginId;
        } catch (error) {
            logger.error(`Failed to add plugin: ${error.message}`);
            throw error;
        }
    }

    removePlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        
        try {
            // Cleanup plugin if active
            if (plugin.isActive && plugin.instance.cleanup) {
                plugin.instance.cleanup();
            }
            
            this.plugins.delete(pluginId);
            logger.info(`Plugin removed: ${plugin.name} (${pluginId})`);
            
            return true;
        } catch (error) {
            logger.error(`Failed to remove plugin ${pluginId}: ${error.message}`);
            throw error;
        }
    }

    async initialize(spider) {
        try {
            this.spider = spider;
            logger.info('Initializing SpiderPluginManager');
            
            // Initialize all plugins
            for (const [pluginId, plugin] of this.plugins) {
                await this.initializePlugin(pluginId);
            }
            
            this.isInitialized = true;
            logger.info('SpiderPluginManager initialized');
            
            return this;
        } catch (error) {
            logger.error(`Failed to initialize SpiderPluginManager: ${error.message}`);
            throw error;
        }
    }

    async initializePlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        
        try {
            if (!plugin.isActive) {
                await plugin.instance.initialize(this.spider);
                plugin.isActive = true;
                logger.info(`Plugin initialized: ${plugin.name}`);
            }
        } catch (error) {
            logger.error(`Failed to initialize plugin ${plugin.name}: ${error.message}`);
            throw error;
        }
    }

    getPlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        return plugin ? plugin.instance : null;
    }

    getPluginNames() {
        return Array.from(this.plugins.values()).map(p => p.name);
    }

    getActivePlugins() {
        return Array.from(this.plugins.values())
            .filter(p => p.isActive)
            .map(p => p.instance);
    }

    getAllPlugins() {
        return Array.from(this.plugins.values()).map(p => ({
            id: p.id,
            name: p.name,
            version: p.version,
            isActive: p.isActive,
            createdAt: p.createdAt
        }));
    }

    async executeHook(hookName, ...args) {
        const activePlugins = this.getActivePlugins();
        const results = [];
        
        for (const plugin of activePlugins) {
            if (plugin[hookName] && typeof plugin[hookName] === 'function') {
                try {
                    const result = await plugin[hookName](...args);
                    results.push({ plugin: plugin.name, result });
                } catch (error) {
                    logger.error(`Plugin ${plugin.name} hook ${hookName} failed: ${error.message}`);
                    results.push({ plugin: plugin.name, error: error.message });
                }
            }
        }
        
        return results;
    }

    async cleanup() {
        try {
            logger.info('Cleaning up SpiderPluginManager');
            
            // Execute cleanup hooks
            await this.executeHook('cleanup');
            
            // Cleanup all plugins
            for (const [pluginId, plugin] of this.plugins) {
                if (plugin.isActive && plugin.instance.cleanup) {
                    try {
                        await plugin.instance.cleanup();
                        plugin.isActive = false;
                        logger.info(`Plugin cleaned up: ${plugin.name}`);
                    } catch (error) {
                        logger.error(`Failed to cleanup plugin ${plugin.name}: ${error.message}`);
                    }
                }
            }
            
            this.isInitialized = false;
            this.spider = null;
            logger.info('SpiderPluginManager cleaned up');
            
            return true;
        } catch (error) {
            logger.error(`Failed to cleanup SpiderPluginManager: ${error.message}`);
            throw error;
        }
    }

    getInfo() {
        return {
            isInitialized: this.isInitialized,
            totalPlugins: this.plugins.size,
            activePlugins: this.getActivePlugins().length,
            plugins: this.getAllPlugins()
        };
    }
}

module.exports = SpiderPluginManager;
