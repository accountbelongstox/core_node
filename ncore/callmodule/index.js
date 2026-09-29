/**
 * Ncore Call Module - Dynamic Module Caller with Express
 *
 * An Express service for dynamically calling ncore modules via HTTP API.
 *
 * Platform-aware launcher:
 * - Windows: System tray + singleton detection
 * - Linux: Service mode (systemd compatible)
 */

const { createApp, getApp } = require('./app');
const { getGlobalConfig, initGlobalConfig } = require('./global_config');
const { launchPlatformAware, launchWindowsTray, launchLinuxService } = require('./platform');

const VERSION = '1.0.0';

module.exports = {
    createApp,
    getApp,
    getGlobalConfig,
    initGlobalConfig,
    launchPlatformAware,
    launchWindowsTray,
    launchLinuxService,
    VERSION
};
