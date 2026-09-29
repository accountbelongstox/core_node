'use strict';

const logger = require('#@logger');

class IPlugin {
    constructor() {
        this._name = null;
        this._version = null;
        this.isInitialized = false;
        this.spider = null;
        this.hooks = new Map();
    }

    get name() {
        return this._name || (() => { throw new Error('IPlugin.name must be implemented by subclass'); })();
    }

    set name(value) {
        this._name = value;
    }

    get version() {
        return this._version || (() => { throw new Error('IPlugin.version must be implemented by subclass'); })();
    }

    set version(value) {
        this._version = value;
    }

    async initialize(spider) {
        throw new Error('IPlugin.initialize() must be implemented by subclass');
    }

    async cleanup() {
        throw new Error('IPlugin.cleanup() must be implemented by subclass');
    }

    async onHook(hookName, callback) {
        if (!this.hooks.has(hookName)) {
            this.hooks.set(hookName, []);
        }
        this.hooks.get(hookName).push(callback);
    }

    async executeHook(hookName, ...args) {
        const hooks = this.hooks.get(hookName) || [];
        const results = [];
        
        for (const hook of hooks) {
            try {
                const result = await hook(...args);
                results.push(result);
            } catch (error) {
                logger.error(`Plugin ${this.name} hook ${hookName} failed:`, error);
            }
        }
        
        return results;
    }

    getInfo() {
        return {
            name: this.name,
            version: this.version,
            isInitialized: this.isInitialized,
            hooks: Array.from(this.hooks.keys())
        };
    }
}

module.exports = IPlugin;
