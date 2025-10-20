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

const PuppeteerSpiderConfig = require('./config.js');
const PuppeteerChromeFinder = require('../utils/chrome-finder.js');
const PuppeteerSpiderPool = require('./pool.js');
const PuppeteerSpiderInstance = require('./instance.js');
const logger = require('#@logger');

// https://peter.sh/experiments/chromium-command-line-switches/

class PuppeteerSpiderManager {
    constructor() {
        this.puppeteerPool = PuppeteerSpiderPool;
        this.puppeteerConfig = PuppeteerSpiderConfig;
        this.puppeteerChromeFinder = PuppeteerChromeFinder;
    }

    /**
     * Create single Puppeteer spider instance
     * @param {Object} config - Configuration object
     * @param {string} presetMode - Preset mode (server, desktop, mobile)
     * @returns {Object} Puppeteer spider instance
     */
    async createPuppeteerSpiderInstance(config = {}, presetMode = null) {
        try {
            const instances = await this.puppeteerPool.createPuppeteerSpiderInstances(config, 1, presetMode);
            if (instances.length > 0) {
                return instances[0];
            }
            throw new Error('Failed to create Puppeteer spider instance');
        } catch (error) {
            logger.error(`Failed to create Puppeteer spider instance: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create multiple Puppeteer spider instances
     * @param {Object} config - Configuration object
     * @param {number} count - Number of instances
     * @param {string} presetMode - Preset mode (server, desktop, mobile)
     * @returns {Array} Array of Puppeteer spider instances
     */
    async createPuppeteerSpiderInstances(config = {}, count = 2, presetMode = null) {
        try {
            return await this.puppeteerPool.createPuppeteerSpiderInstances(config, count, presetMode);
        } catch (error) {
            logger.error(`Failed to create Puppeteer spider instances: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get first available Puppeteer spider instance
     * @returns {Object|null} First Puppeteer spider instance or null
     */
    getFirstPuppeteerSpiderInstance() {
        return this.puppeteerPool.getFirstPuppeteerSpiderInstance();
    }

    /**
     * Get Puppeteer spider instance by ID
     * @param {number} id - Instance ID
     * @returns {Object|null} Puppeteer spider instance or null
     */
    getPuppeteerSpiderInstance(id) {
        return this.puppeteerPool.getPuppeteerSpiderInstance(id);
    }

    /**
     * Get all Puppeteer spider instances
     * @returns {Array} Array of all Puppeteer spider instances
     */
    getAllPuppeteerSpiderInstances() {
        return this.puppeteerPool.getAllPuppeteerSpiderInstances();
    }

    /**
     * Mark Puppeteer spider instance as busy
     * @param {number} id - Instance ID
     */
    markPuppeteerSpiderInstanceBusy(id) {
        this.puppeteerPool.markPuppeteerSpiderInstanceBusy(id);
    }

    /**
     * Mark Puppeteer spider instance as ready
     * @param {number} id - Instance ID
     */
    markPuppeteerSpiderInstanceReady(id) {
        this.puppeteerPool.markPuppeteerSpiderInstanceReady(id);
    }

    /**
     * Mark Puppeteer spider instance as error
     * @param {number} id - Instance ID
     */
    markPuppeteerSpiderInstanceError(id) {
        this.puppeteerPool.markPuppeteerSpiderInstanceError(id);
    }

    /**
     * Remove Puppeteer spider instance from pool
     * @param {number} id - Instance ID
     */
    async removePuppeteerSpiderInstance(id) {
        await this.puppeteerPool.removePuppeteerSpiderInstance(id);
    }

    /**
     * Clean up error Puppeteer spider instances
     */
    async cleanupErrorPuppeteerSpiderInstances() {
        await this.puppeteerPool.cleanupErrorPuppeteerSpiderInstances();
    }

    /**
     * Kill uncontrollable Puppeteer spider instances
     */
    async killUncontrollablePuppeteerSpiderInstances() {
        await this.puppeteerPool.killUncontrollablePuppeteerSpiderInstances();
    }

    /**
     * Close all Puppeteer spider instances
     */
    async closeAllPuppeteerSpiderInstances() {
        await this.puppeteerPool.closeAllPuppeteerSpiderInstances();
    }

    /**
     * Get Puppeteer spider pool statistics
     * @returns {Object} Pool statistics
     */
    getPuppeteerSpiderPoolStats() {
        return this.puppeteerPool.getPuppeteerSpiderPoolStats();
    }

    /**
     * Find Puppeteer compatible Chrome path
     * @returns {Object|null} Chrome info object or null
     */
    async findPuppeteerCompatibleChrome() {
        return await this.puppeteerChromeFinder.findPuppeteerCompatibleChrome();
    }

    /**
     * Ensure Puppeteer compatible Chrome is installed
     * @returns {Object|null} Chrome info object or null
     */
    async ensurePuppeteerCompatibleChrome() {
        return await this.puppeteerChromeFinder.ensurePuppeteerCompatibleChrome();
    }

    /**
     * Kill Puppeteer Chrome process by PID
     * @param {number} pid - Process ID
     */
    async killPuppeteerChromeProcess(pid) {
        await this.puppeteerChromeFinder.killPuppeteerChromeProcess(pid);
    }

    /**
     * Kill all Puppeteer Chrome processes
     */
    async killAllPuppeteerChromeProcesses() {
        await this.puppeteerChromeFinder.killAllPuppeteerChromeProcesses();
    }

    /**
     * Initialize Puppeteer spider configuration
     * @param {Object} customConfig - Custom configuration
     * @param {string} presetMode - Preset mode (server, desktop, mobile)
     * @returns {Object} Initialized configuration
     */
    async initPuppeteerSpiderConfig(customConfig = {}, presetMode = null) {
        return await this.puppeteerConfig.initPuppeteerSpiderConfig(customConfig, presetMode);
    }

    /**
     * Build Puppeteer Chrome arguments
     * @param {Object} config - Configuration object
     * @returns {Array} Chrome arguments
     */
    buildPuppeteerChromeArgs(config) {
        return this.puppeteerConfig.buildPuppeteerChromeArgs(config);
    }

    /**
     * Build Puppeteer Chrome ignore arguments
     * @param {boolean} mute - Whether to mute
     * @returns {Array} Ignore arguments
     */
    buildPuppeteerChromeIgnoreArgs(mute = true) {
        return this.puppeteerConfig.buildPuppeteerChromeIgnoreArgs(mute);
    }

    /**
     * Get preset mode configuration
     * @param {string} mode - Preset mode name
     * @returns {Object|null} Preset configuration or null
     */
    getPresetMode(mode) {
        return this.puppeteerConfig.getPresetMode(mode);
    }

    /**
     * Get available preset modes
     * @returns {Array} Array of preset mode names
     */
    getAvailablePresetModes() {
        return this.puppeteerConfig.getAvailablePresetModes();
    }
}

module.exports = new PuppeteerSpiderManager(); 