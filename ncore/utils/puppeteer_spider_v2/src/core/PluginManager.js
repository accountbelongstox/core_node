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
const IPlugin = require('../interfaces/IPlugin');

class PluginManager {
    constructor() {
        this.plugins = new Map();
        this.hooks = new Map();
        this.isInitialized = false;
        this.metrics = {
            pluginsLoaded: 0,
            pluginsUnloaded: 0,
            hooksExecuted: 0,
            hookErrors: 0
        };
    }

    async loadPlugins() {
        try {
            logger.info('Loading built-in plugins...');
            
            // Load core plugins
            const DownloadPlugin = require('../plugins/core/DownloadPlugin');
            const ContentPlugin = require('../plugins/core/ContentPlugin');
            const AutomationPlugin = require('../plugins/core/AutomationPlugin');
            
            await this.loadPlugin(new DownloadPlugin());
            await this.loadPlugin(new ContentPlugin());
            await this.loadPlugin(new AutomationPlugin());
            
            this.isInitialized = true;
            logger.info('Built-in plugins loaded successfully');
        } catch (error) {
            logger.error('Failed to load plugins:', error);
            throw error;
        }
    }

    async loadPlugin(plugin) {
        if (!(plugin instanceof IPlugin)) {
            throw new Error('Plugin must extend IPlugin class');
        }

        if (this.plugins.has(plugin.name)) {
            logger.warn(`Plugin ${plugin.name} is already loaded`);
            return;
        }

        try {
            await plugin.initialize(this);
            this.plugins.set(plugin.name, plugin);
            this.metrics.pluginsLoaded++;
            
            logger.info(`Plugin loaded: ${plugin.name} v${plugin.version}`);
        } catch (error) {
            logger.error(`Failed to load plugin ${plugin.name}:`, error);
            throw error;
        }
    }

    async unloadPlugin(pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            logger.warn(`Plugin ${pluginName} not found`);
            return;
        }

        try {
            await plugin.cleanup();
            this.plugins.delete(pluginName);
            this.metrics.pluginsUnloaded++;
            
            logger.info(`Plugin unloaded: ${pluginName}`);
        } catch (error) {
            logger.error(`Failed to unload plugin ${pluginName}:`, error);
            throw error;
        }
    }

    getPlugin(pluginName) {
        return this.plugins.get(pluginName);
    }

    getAllPlugins() {
        return Array.from(this.plugins.values());
    }

    async initializeSession(session) {
        for (const [pluginName, plugin] of this.plugins) {
            try {
                await session.loadPlugin(plugin);
                logger.debug(`Plugin ${pluginName} initialized for session ${session.id}`);
            } catch (error) {
                logger.error(`Failed to initialize plugin ${pluginName} for session ${session.id}:`, error);
            }
        }
    }

    async executeHook(hookName, ...args) {
        const hooks = this.hooks.get(hookName) || [];
        const results = [];
        
        logger.debug(`Executing hook: ${hookName} with ${hooks.length} handlers`);
        
        for (const hook of hooks) {
            try {
                const result = await hook(...args);
                results.push(result);
                this.metrics.hooksExecuted++;
            } catch (error) {
                this.metrics.hookErrors++;
                logger.error(`Hook ${hookName} failed:`, error);
            }
        }
        
        return results;
    }

    registerHook(hookName, callback) {
        if (!this.hooks.has(hookName)) {
            this.hooks.set(hookName, []);
        }
        
        this.hooks.get(hookName).push(callback);
        logger.debug(`Hook registered: ${hookName}`);
    }

    unregisterHook(hookName, callback) {
        if (!this.hooks.has(hookName)) {
            return;
        }
        
        const hooks = this.hooks.get(hookName);
        const index = hooks.indexOf(callback);
        
        if (index > -1) {
            hooks.splice(index, 1);
            logger.debug(`Hook unregistered: ${hookName}`);
        }
    }

    async cleanup() {
        try {
            logger.info('Cleaning up PluginManager...');
            
            for (const [pluginName, plugin] of this.plugins) {
                try {
                    await plugin.cleanup();
                } catch (error) {
                    logger.warn(`Failed to cleanup plugin ${pluginName}:`, error);
                }
            }
            
            this.plugins.clear();
            this.hooks.clear();
            this.isInitialized = false;
            
            logger.info('PluginManager cleanup completed');
        } catch (error) {
            logger.error('Failed to cleanup PluginManager:', error);
            throw error;
        }
    }

    getInfo() {
        const pluginInfo = {};
        for (const [name, plugin] of this.plugins) {
            pluginInfo[name] = {
                version: plugin.version,
                isInitialized: plugin.isInitialized,
                hooks: plugin.hooks ? Array.from(plugin.hooks.keys()) : []
            };
        }
        
        return {
            isInitialized: this.isInitialized,
            totalPlugins: this.plugins.size,
            plugins: pluginInfo,
            hooks: Array.from(this.hooks.keys()),
            metrics: this.metrics
        };
    }
}

module.exports = PluginManager;
