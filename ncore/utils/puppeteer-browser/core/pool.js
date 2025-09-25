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
const PuppeteerSpiderInstance = require('./instance.js');

class PuppeteerSpiderPool {
    constructor() {
        this.puppeteerInstances = new Map();
        this.instanceCounter = 0;
        this.isShuttingDown = false;
    }

    /**
     * Create Puppeteer spider instances
     * @param {Object} config - Configuration object
     * @param {number} count - Number of instances to create
     * @param {string} presetMode - Preset mode (server, desktop, mobile)
     * @returns {Array} Array of Puppeteer spider instances
     */
    async createPuppeteerSpiderInstances(config = {}, count = 1, presetMode = null) {
        const instances = [];
        
        for (let i = 0; i < count; i++) {
            try {
                const instance = new PuppeteerSpiderInstance(config);
                await instance.initializePuppeteerSpiderInstance();
                
                const instanceId = this.instanceCounter++;
                this.puppeteerInstances.set(instanceId, {
                    id: instanceId,
                    puppeteerInstance: instance,
                    config: config,
                    presetMode: presetMode,
                    status: 'ready',
                    createdAt: Date.now()
                });
                
                instances.push({
                    id: instanceId,
                    puppeteerInstance: instance
                });
                
                logger.info(`Created Puppeteer spider instance ${instanceId} with preset mode: ${presetMode || 'default'}`);
            } catch (error) {
                logger.error(`Failed to create Puppeteer spider instance: ${error.message}`);
            }
        }
        
        return instances;
    }

    /**
     * Get first available Puppeteer spider instance
     * @returns {Object|null} First Puppeteer spider instance or null
     */
    getFirstPuppeteerSpiderInstance() {
        for (const [id, data] of this.puppeteerInstances) {
            if (data.status === 'ready') {
                return {
                    id: id,
                    puppeteerInstance: data.puppeteerInstance
                };
            }
        }
        return null;
    }

    /**
     * Get Puppeteer spider instance by ID
     * @param {number} id - Instance ID
     * @returns {Object|null} Puppeteer spider instance or null
     */
    getPuppeteerSpiderInstance(id) {
        const data = this.puppeteerInstances.get(id);
        return data ? {
            id: data.id,
            puppeteerInstance: data.puppeteerInstance
        } : null;
    }

    /**
     * Get all Puppeteer spider instances
     * @returns {Array} Array of all Puppeteer spider instances
     */
    getAllPuppeteerSpiderInstances() {
        const result = [];
        for (const [id, data] of this.puppeteerInstances) {
            result.push({
                id: data.id,
                puppeteerInstance: data.puppeteerInstance,
                status: data.status,
                presetMode: data.presetMode,
                createdAt: data.createdAt
            });
        }
        return result;
    }

    /**
     * Mark Puppeteer spider instance as busy
     * @param {number} id - Instance ID
     */
    markPuppeteerSpiderInstanceBusy(id) {
        const data = this.puppeteerInstances.get(id);
        if (data) {
            data.status = 'busy';
        }
    }

    /**
     * Mark Puppeteer spider instance as ready
     * @param {number} id - Instance ID
     */
    markPuppeteerSpiderInstanceReady(id) {
        const data = this.puppeteerInstances.get(id);
        if (data) {
            data.status = 'ready';
        }
    }

    /**
     * Mark Puppeteer spider instance as error
     * @param {number} id - Instance ID
     */
    markPuppeteerSpiderInstanceError(id) {
        const data = this.puppeteerInstances.get(id);
        if (data) {
            data.status = 'error';
        }
    }

    /**
     * Remove Puppeteer spider instance from pool
     * @param {number} id - Instance ID
     */
    async removePuppeteerSpiderInstance(id) {
        const data = this.puppeteerInstances.get(id);
        if (data) {
            try {
                await data.puppeteerInstance.closePuppeteerSpiderInstance();
                this.puppeteerInstances.delete(id);
                logger.info(`Removed Puppeteer spider instance ${id}`);
            } catch (error) {
                logger.error(`Failed to remove Puppeteer spider instance ${id}: ${error.message}`);
            }
        }
    }

    /**
     * Clean up error Puppeteer spider instances
     */
    async cleanupErrorPuppeteerSpiderInstances() {
        const errorInstances = [];
        for (const [id, data] of this.puppeteerInstances) {
            if (data.status === 'error') {
                errorInstances.push(id);
            }
        }
        
        for (const id of errorInstances) {
            await this.removePuppeteerSpiderInstance(id);
        }
        
        if (errorInstances.length > 0) {
            logger.info(`Cleaned up ${errorInstances.length} error Puppeteer spider instances`);
        }
    }

    /**
     * Kill uncontrollable Puppeteer spider instances
     */
    async killUncontrollablePuppeteerSpiderInstances() {
        const chromeFinder = require('./chrome-finder.js');
        
        for (const [id, data] of this.puppeteerInstances) {
            if (data.status === 'error') {
                try {
                    // Try to get browser process ID
                    const browser = data.puppeteerInstance.puppeteerBrowser;
                    if (browser && browser.process()) {
                        const pid = browser.process().pid;
                        await chromeFinder.killPuppeteerChromeProcess(pid);
                        logger.info(`Killed uncontrollable Chrome process ${pid} for Puppeteer spider instance ${id}`);
                    }
                } catch (error) {
                    logger.error(`Failed to kill uncontrollable Puppeteer spider instance ${id}: ${error.message}`);
                }
            }
        }
    }

    /**
     * Close all Puppeteer spider instances
     */
    async closeAllPuppeteerSpiderInstances() {
        this.isShuttingDown = true;
        const closePromises = [];
        
        for (const [id, data] of this.puppeteerInstances) {
            closePromises.push(this.removePuppeteerSpiderInstance(id));
        }
        
        await Promise.allSettled(closePromises);
        logger.info('Closed all Puppeteer spider instances');
    }

    /**
     * Get Puppeteer spider pool statistics
     * @returns {Object} Pool statistics
     */
    getPuppeteerSpiderPoolStats() {
        const stats = {
            total: this.puppeteerInstances.size,
            ready: 0,
            busy: 0,
            error: 0,
            presetModes: {}
        };
        
        for (const [id, data] of this.puppeteerInstances) {
            stats[data.status]++;
            
            // Count by preset mode
            const mode = data.presetMode || 'default';
            if (!stats.presetModes[mode]) {
                stats.presetModes[mode] = 0;
            }
            stats.presetModes[mode]++;
        }
        
        return stats;
    }
}

module.exports = new PuppeteerSpiderPool(); 