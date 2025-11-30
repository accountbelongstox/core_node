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
 * OKX Price Monitor App - Main Entry Point
 *
 * This app monitors OKX cryptocurrency prices by fetching data from
 * https://www.okx.com/markets/prices/page/4 every second.
 *
 * @module OKXPriceMonitor
 */

const logger = require('#@logger');
const gconfig = require('#@gconfig');
const globalDir = require('#@global_dir');
const OKXMonitorService = require('./service/okxMonitor.js');

// Load local config directly as fallback
const localConfig = require('./config/index.js');

let monitorInstance = null;

/**
 * Start the OKX Price Monitor application
 * @param {Object} options - Application options
 */
async function start(options = {}) {
    try {
        logger.info('Starting OKX Price Monitor application...');

        // Initialize app configuration (use gconfig or fallback to local config)
        const appConfig = gconfig.okx_price_monitor || localConfig.okx_price_monitor;

        if (!appConfig || !appConfig.basePageUrl || !appConfig.apiUrlTemplate) {
            logger.error('Failed to load configuration. basePageUrl and apiUrlTemplate are required.');
            logger.error('Config loaded:', JSON.stringify(appConfig, null, 2));
            return;
        }

        // Create monitor instance
        monitorInstance = new OKXMonitorService(appConfig);

        // Start monitoring
        await monitorInstance.start();

        logger.info('OKX Price Monitor application started successfully');
        logger.info(`Base Page URL: ${appConfig.basePageUrl}`);
        logger.info(`API URL Template: ${appConfig.apiUrlTemplate}`);
        logger.info(`Currencies: ${appConfig.currencies?.length || 0} items`);
        logger.info(`Fetch interval: ${appConfig.fetchInterval}ms`);

        // Handle process termination
        process.on('SIGINT', async () => {
            logger.info('Received SIGINT, stopping monitor...');
            await stop();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            logger.info('Received SIGTERM, stopping monitor...');
            await stop();
            process.exit(0);
        });

    } catch (error) {
        logger.error('Failed to start OKX Price Monitor application:', error);
        process.exit(1);
    }
}

/**
 * Stop the OKX Price Monitor application
 */
async function stop() {
    try {
        if (monitorInstance) {
            await monitorInstance.stop();
            monitorInstance = null;
            logger.info('OKX Price Monitor application stopped successfully');
        }
    } catch (error) {
        logger.error('Failed to stop OKX Price Monitor application:', error);
    }
}

/**
 * Get monitor instance for external access
 */
function getMonitorInstance() {
    return monitorInstance;
}

// Export the start function and utilities
module.exports = {
    start,
    stop,
    getMonitorInstance
};
