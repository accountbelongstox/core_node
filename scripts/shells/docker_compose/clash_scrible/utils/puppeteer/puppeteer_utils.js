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

const path = require('path');
const { checkPuppeteerAvailability, getBrowser } = require('./puppeteer_base_utils');
const { takeScreenshot, cleanOldScreenshots } = require('./puppeteer_helper_utils');
const {
    closeExtraWindows, checkLoginStatus, login, openWebsite,
    openOpenclash, openYacd, clickYacdButton, getProxyInfo
} = require('./puppeteer_router_utils');
const { puppeteer_dir } = require('../../provider/global_var');
const logger = require('../log_utils');

function standardPuppeteerResponse(func) {
    return async function(...args) {
        const [available, message] = await checkPuppeteerAvailability();
        if (!available) {
            return {
                success: false,
                message: message,
                data: null,
                screenshot: null
            };
        }
        
        try {
            const result = await func(...args);
            let screenshotPath = null;
            return {
                success: result.success,
                message: result.message,
                data: result.data,
                screenshot: screenshotPath ? screenshotPath.toString() : null
            };
        } catch (e) {
            return {
                success: false,
                message: e.toString(),
                data: null,
                screenshot: null
            };
        }
    };
}

async function checkPuppeteerEnvironment() {
    const [browser, message] = await getBrowser();
    if (!browser) {
        return { success: false, message: message, data: null };
    }
    const version = browser.version;
    const chrome = browser.chrome.version;
    return {
        success: true,
        message: "Puppeteer environment checked successfully",
        data: {
            chrome,
            puppeteer: version
        }
    };
}

// Wrap all functions with the standardPuppeteerResponse decorator
const wrappedCheckPuppeteerEnvironment = standardPuppeteerResponse(checkPuppeteerEnvironment);
const wrappedCloseExtraWindows = standardPuppeteerResponse(closeExtraWindows);
const wrappedCheckLoginStatus = standardPuppeteerResponse(checkLoginStatus);
const wrappedLogin = standardPuppeteerResponse(login);
const wrappedOpenWebsite = standardPuppeteerResponse(openWebsite);
const wrappedOpenOpenclash = standardPuppeteerResponse(openOpenclash);
const wrappedOpenYacd = standardPuppeteerResponse(openYacd);
const wrappedGetProxyInfo = standardPuppeteerResponse(getProxyInfo);

module.exports = {
    checkPuppeteerEnvironment: wrappedCheckPuppeteerEnvironment,
    closeExtraWindows: wrappedCloseExtraWindows,
    checkLoginStatus: wrappedCheckLoginStatus,
    login: wrappedLogin,
    openWebsite: wrappedOpenWebsite,
    openOpenclash: wrappedOpenOpenclash,
    openYacd: wrappedOpenYacd,
    getProxyInfo: wrappedGetProxyInfo
};