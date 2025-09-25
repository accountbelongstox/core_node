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
 * Puppeteer Browser Module - Main Entry Point
 * 
 * This module provides a comprehensive browser automation solution with stealth protection,
 * instance management, and organized functional APIs.
 * 
 * @module puppeteer-browser
 */

// Core management modules
const main = require('./core/main.js');
const api = require('./puppeteer-api/api.js');

// Functional modules
const navigation = require('./puppeteer-api/navigation.js');
const script = require('./puppeteer-api/script.js');
const download = require('./puppeteer-api/download.js');
const screenshot = require('./puppeteer-api/screenshot.js');
const interaction = require('./puppeteer-api/interaction.js');

// Utility modules
const config = require('./core/config.js');
const pool = require('./core/pool.js');
const instance = require('./core/instance.js');
const chromeFinder = require('./utils/chrome-finder.js');
const chromeVersion = require('./utils/chrome-version.js');

// Export unified API
module.exports = {
    // Main manager
    manager: main,
    
    // Unified API
    api: api,
    
    // Functional modules
    navigation: navigation,
    script: script,
    download: download,
    screenshot: screenshot,
    interaction: interaction,
    
    // Utility modules
    config: config,
    pool: pool,
    instance: instance,
    chromeFinder: chromeFinder,
    chromeVersion: chromeVersion,
    
    // Backward compatibility
    createInstance: main.createPuppeteerSpiderInstance,
    createInstances: main.createPuppeteerSpiderInstances,
    getInstance: main.getPuppeteerSpiderInstance,
    closeInstance: main.closePuppeteerSpiderInstance,
    closeAllInstances: main.closeAllPuppeteerSpiderInstances,
    getPoolStats: main.getPuppeteerSpiderPoolStats,
    findCompatibleChrome: main.findPuppeteerCompatibleChrome,
    ensureCompatibleChrome: main.ensurePuppeteerCompatibleChrome
}; 