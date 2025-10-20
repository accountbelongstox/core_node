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

const puppeteerSpiderManager = require('../core/main.js');
const navigation = require('./navigation.js');
const script = require('./script.js');
const download = require('./download.js');
const screenshot = require('./screenshot.js');
const interaction = require('./interaction.js');
const logger = require('#@logger');

/**
 * Unified Puppeteer API Class
 * Provides a comprehensive interface for all Puppeteer operations
 */
class PuppeteerAPI {
    constructor() {
        this.defaultInstanceId = 0;
        this.navigation = navigation;
        this.script = script;
        this.download = download;
        this.screenshot = screenshot;
        this.interaction = interaction;
    }

    /**
     * Get Puppeteer instance by ID
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {Object} Puppeteer instance
     */
    getInstance(instanceId = this.defaultInstanceId) {
        return puppeteerSpiderManager.getPuppeteerSpiderInstance(instanceId);
    }

    // Navigation methods
    async openUrl(url, instanceId = this.defaultInstanceId) {
        return this.navigation.openUrl(url, instanceId);
    }

    async forceOpenUrl(url, instanceId = this.defaultInstanceId) {
        return this.navigation.forceOpenUrl(url, instanceId);
    }

    async switchToTab(tabIndex, instanceId = this.defaultInstanceId) {
        return this.navigation.switchToTab(tabIndex, instanceId);
    }

    async switchToUrl(url, instanceId = this.defaultInstanceId) {
        return this.navigation.switchToUrl(url, instanceId);
    }

    async getActivePage(instanceId = this.defaultInstanceId) {
        return this.navigation.getActivePage(instanceId);
    }

    async closeTab(tabIndex, instanceId = this.defaultInstanceId) {
        return this.navigation.closeTab(tabIndex, instanceId);
    }

    async closeUrl(url, instanceId = this.defaultInstanceId) {
        return this.navigation.closeUrl(url, instanceId);
    }

    async fetchRenderedHtml(url, options = {}, instanceId = this.defaultInstanceId) {
        return this.navigation.fetchRenderedHtml(url, options, instanceId);
    }

    // Script execution methods
    async runScript(script, instanceId = this.defaultInstanceId) {
        return this.script.runScript(script, instanceId);
    }

    async runScriptFile(filePath, instanceId = this.defaultInstanceId) {
        return this.script.runScriptFile(filePath, instanceId);
    }

    async runScriptUrl(url, instanceId = this.defaultInstanceId) {
        return this.script.runScriptUrl(url, instanceId);
    }

    async getIndexedDBData(instanceId = this.defaultInstanceId) {
        return this.script.getIndexedDBData(instanceId);
    }

    // Download methods
    async downloadEmbedded(url, targetPath, instanceId = this.defaultInstanceId) {
        return this.download.downloadEmbedded(url, targetPath, instanceId);
    }

    async downloadByClick(url, targetPath, instanceId = this.defaultInstanceId) {
        return this.download.downloadByClick(url, targetPath, instanceId);
    }

    // Screenshot methods
    async takeScreenshot(path, options = {}, instanceId = this.defaultInstanceId) {
        return this.screenshot.takeScreenshot(path, options, instanceId);
    }

    async takeAreaScreenshot(path, area, instanceId = this.defaultInstanceId) {
        return this.screenshot.takeAreaScreenshot(path, area, instanceId);
    }

    async takeElementScreenshot(path, selector, instanceId = this.defaultInstanceId) {
        return this.screenshot.takeElementScreenshot(path, selector, instanceId);
    }

    // Interaction methods
    async waitForElement(selector, options = {}, instanceId = this.defaultInstanceId) {
        return this.interaction.waitForElement(selector, options, instanceId);
    }

    async clickElement(selector, instanceId = this.defaultInstanceId) {
        return this.interaction.clickElement(selector, instanceId);
    }

    async typeText(selector, text, instanceId = this.defaultInstanceId) {
        return this.interaction.typeText(selector, text, instanceId);
    }

    async dragAndDrop(selector, trajectory, speed = 100, instanceId = this.defaultInstanceId) {
        return this.interaction.dragAndDrop(selector, trajectory, speed, instanceId);
    }

    async getContent(selector, instanceId = this.defaultInstanceId) {
        return this.interaction.getContent(selector, instanceId);
    }

    async getElementText(selector, instanceId = this.defaultInstanceId) {
        return this.interaction.getElementText(selector, instanceId);
    }

    async getElementAttribute(selector, attribute, instanceId = this.defaultInstanceId) {
        return this.interaction.getElementAttribute(selector, attribute, instanceId);
    }

    async scrollToElement(selector, instanceId = this.defaultInstanceId) {
        return this.interaction.scrollToElement(selector, instanceId);
    }

    async hoverElement(selector, instanceId = this.defaultInstanceId) {
        return this.interaction.hoverElement(selector, instanceId);
    }

    async focusElement(selector, instanceId = this.defaultInstanceId) {
        return this.interaction.focusElement(selector, instanceId);
    }

    // Instance management methods
    async createInstance(config = {}, presetMode = null) {
        return puppeteerSpiderManager.createPuppeteerSpiderInstance(config, presetMode);
    }

    async createInstances(config = {}, count = 1, presetMode = null) {
        return puppeteerSpiderManager.createPuppeteerSpiderInstances(config, count, presetMode);
    }

    getInstanceById(instanceId) {
        return puppeteerSpiderManager.getPuppeteerSpiderInstance(instanceId);
    }

    async closeInstance(instanceId) {
        return puppeteerSpiderManager.closePuppeteerSpiderInstance(instanceId);
    }

    async closeAllInstances() {
        return puppeteerSpiderManager.closeAllPuppeteerSpiderInstances();
    }

    getPoolStats() {
        return puppeteerSpiderManager.getPuppeteerSpiderPoolStats();
    }

    async findCompatibleChrome() {
        return puppeteerSpiderManager.findPuppeteerCompatibleChrome();
    }

    async ensureCompatibleChrome() {
        return puppeteerSpiderManager.ensurePuppeteerCompatibleChrome();
    }

    /**
     * Set default instance ID
     * @param {number} instanceId - Instance ID to set as default
     */
    setDefaultInstance(instanceId) {
        this.defaultInstanceId = instanceId;
        this.navigation.defaultInstanceId = instanceId;
        this.script.defaultInstanceId = instanceId;
        this.download.defaultInstanceId = instanceId;
        this.screenshot.defaultInstanceId = instanceId;
        this.interaction.defaultInstanceId = instanceId;
    }

    /**
     * Get all available functions
     * @returns {Object} Object containing all available functions
     */
    getFunctions() {
        return {
            // Navigation
            openUrl: this.openUrl.bind(this),
            forceOpenUrl: this.forceOpenUrl.bind(this),
            switchToTab: this.switchToTab.bind(this),
            switchToUrl: this.switchToUrl.bind(this),
            getActivePage: this.getActivePage.bind(this),
            closeTab: this.closeTab.bind(this),
            closeUrl: this.closeUrl.bind(this),
            fetchRenderedHtml: this.fetchRenderedHtml.bind(this),

            // Script execution
            runScript: this.runScript.bind(this),
            runScriptFile: this.runScriptFile.bind(this),
            runScriptUrl: this.runScriptUrl.bind(this),
            getIndexedDBData: this.getIndexedDBData.bind(this),

            // Download
            downloadEmbedded: this.downloadEmbedded.bind(this),
            downloadByClick: this.downloadByClick.bind(this),

            // Screenshot
            takeScreenshot: this.takeScreenshot.bind(this),
            takeAreaScreenshot: this.takeAreaScreenshot.bind(this),
            takeElementScreenshot: this.takeElementScreenshot.bind(this),

            // Interaction
            waitForElement: this.waitForElement.bind(this),
            clickElement: this.clickElement.bind(this),
            typeText: this.typeText.bind(this),
            dragAndDrop: this.dragAndDrop.bind(this),
            getContent: this.getContent.bind(this),
            getElementText: this.getElementText.bind(this),
            getElementAttribute: this.getElementAttribute.bind(this),
            scrollToElement: this.scrollToElement.bind(this),
            hoverElement: this.hoverElement.bind(this),
            focusElement: this.focusElement.bind(this),

            // Instance management
            createInstance: this.createInstance.bind(this),
            createInstances: this.createInstances.bind(this),
            getInstanceById: this.getInstanceById.bind(this),
            closeInstance: this.closeInstance.bind(this),
            closeAllInstances: this.closeAllInstances.bind(this),
            getPoolStats: this.getPoolStats.bind(this),
            findCompatibleChrome: this.findCompatibleChrome.bind(this),
            ensureCompatibleChrome: this.ensureCompatibleChrome.bind(this),
            setDefaultInstance: this.setDefaultInstance.bind(this)
        };
    }
}

module.exports = new PuppeteerAPI(); 