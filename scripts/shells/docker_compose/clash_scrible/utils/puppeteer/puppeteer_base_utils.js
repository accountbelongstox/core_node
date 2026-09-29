const {browser} = require('../../node_spider/climber/main');
const logger = require('../log_utils');

// Global variables
let PUPPETEER_AVAILABLE = false;
let DRIVER = null;

async function checkPuppeteerAvailability() {
    if (PUPPETEER_AVAILABLE) {
        return [true, "Puppeteer is available"];
    }
    try {
        DRIVER = await browser.createDriver();;
        PUPPETEER_AVAILABLE = true;
        return [true, "Puppeteer is available"];
    } catch (error) {
        logger.log(error);
        logger.log(`Puppeteer check failed: ${error}`);
        return [false, "Puppeteer is not installed or not available"];
    }
}

async function getBrowser() {
    const [available, message] = await checkPuppeteerAvailability();
    if (!available) {
        return [null, message];
    }
    if (DRIVER === null) {
        try {
            DRIVER = await browser.createDriver();;
            return [DRIVER, "Driver created successfully"];
        } catch (e) {
            logger.log(`Failed to create driver: ${e}`);
            return [null, `Failed to create driver: ${e}`];
        }
    }
    return [DRIVER, "Existing driver returned"];
}

module.exports = {
    checkPuppeteerAvailability,
    getBrowser
};