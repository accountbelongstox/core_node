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

class IPlugin {
    constructor() {
        this.name = null;
        this.version = null;
        this.isInitialized = false;
        this.spider = null;
        this.hooks = new Map();
    }

    get name() {
        throw new Error('IPlugin.name must be implemented by subclass');
    }

    get version() {
        throw new Error('IPlugin.version must be implemented by subclass');
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
