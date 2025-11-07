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
const ConfigManager = require('../config/ConfigManager');
const SessionManager = require('./SessionManager');
const ResourcePool = require('./ResourcePool');
const EventBus = require('./EventBus');
const PluginManager = require('./PluginManager');

class SpiderEngine {
    constructor(config = {}) {
        this.config = new ConfigManager(config);
        this.sessionManager = new SessionManager();
        this.resourcePool = new ResourcePool();
        this.eventBus = new EventBus();
        this.pluginManager = new PluginManager();
        this.isInitialized = false;
        this.metrics = {
            sessionsCreated: 0,
            sessionsClosed: 0,
            pluginsLoaded: 0,
            startTime: null
        };
    }

    async initialize() {
        try {
            logger.info('Initializing SpiderEngine...');
            this.metrics.startTime = Date.now();
            
            await this.config.load();
            await this.resourcePool.initialize();
            await this.pluginManager.loadPlugins();
            
            this.isInitialized = true;
            this.eventBus.emit('engine:initialized', this.getInfo());
            
            logger.info('SpiderEngine initialized successfully');
            return this;
        } catch (error) {
            logger.error('Failed to initialize SpiderEngine:', error);
            throw error;
        }
    }

    async createSession(options = {}) {
        if (!this.isInitialized) {
            throw new Error('SpiderEngine must be initialized before creating sessions');
        }

        try {
            const sessionConfig = this.config.mergeSessionConfig(options);
            const session = await this.sessionManager.create(sessionConfig);
            
            await this.pluginManager.initializeSession(session);
            this.metrics.sessionsCreated++;
            
            this.eventBus.emit('session:created', session.getInfo());
            logger.info(`Session created: ${session.id}`);
            
            return session;
        } catch (error) {
            logger.error('Failed to create session:', error);
            throw error;
        }
    }

    async closeSession(sessionId) {
        try {
            const session = await this.sessionManager.close(sessionId);
            if (session) {
                this.metrics.sessionsClosed++;
                this.eventBus.emit('session:closed', session.getInfo());
                logger.info(`Session closed: ${sessionId}`);
            }
            return session;
        } catch (error) {
            logger.error(`Failed to close session ${sessionId}:`, error);
            throw error;
        }
    }

    getSession(sessionId) {
        return this.sessionManager.get(sessionId);
    }

    getAllSessions() {
        return this.sessionManager.getAll();
    }

    async loadPlugin(plugin) {
        try {
            await this.pluginManager.loadPlugin(plugin);
            this.metrics.pluginsLoaded++;
            this.eventBus.emit('plugin:loaded', plugin.getInfo());
            logger.info(`Plugin loaded: ${plugin.name}`);
        } catch (error) {
            logger.error(`Failed to load plugin ${plugin.name}:`, error);
            throw error;
        }
    }

    async unloadPlugin(pluginName) {
        try {
            await this.pluginManager.unloadPlugin(pluginName);
            this.eventBus.emit('plugin:unloaded', { name: pluginName });
            logger.info(`Plugin unloaded: ${pluginName}`);
        } catch (error) {
            logger.error(`Failed to unload plugin ${pluginName}:`, error);
            throw error;
        }
    }

    async shutdown() {
        try {
            logger.info('Shutting down SpiderEngine...');
            
            await this.sessionManager.closeAll();
            await this.pluginManager.cleanup();
            await this.resourcePool.cleanup();
            
            this.isInitialized = false;
            this.eventBus.emit('engine:shutdown', this.getMetrics());
            
            logger.info('SpiderEngine shutdown completed');
        } catch (error) {
            logger.error('Failed to shutdown SpiderEngine:', error);
            throw error;
        }
    }

    getInfo() {
        return {
            isInitialized: this.isInitialized,
            config: this.config.getInfo(),
            sessions: this.sessionManager.getInfo(),
            plugins: this.pluginManager.getInfo(),
            resources: this.resourcePool.getInfo(),
            metrics: this.getMetrics()
        };
    }

    getMetrics() {
        const uptime = this.metrics.startTime ? Date.now() - this.metrics.startTime : 0;
        return {
            ...this.metrics,
            uptime,
            activeSessions: this.sessionManager.getAll().length
        };
    }

    on(event, callback) {
        this.eventBus.on(event, callback);
    }

    off(event, callback) {
        this.eventBus.off(event, callback);
    }

    emit(event, data) {
        this.eventBus.emit(event, data);
    }
}

module.exports = SpiderEngine;
