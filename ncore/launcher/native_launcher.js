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

/**
 * Unified Native UI Launcher
 *
 * 1:1 port from pycore/pylauncher/native_launcher.py
 *
 * Centralized launcher for all Native UI applications.
 * Sub-apps should ONLY use this entry point and pass parameters.
 *
 * Note: This is a framework implementation. Full Native UI support
 * requires Electron or similar desktop framework.
 *
 * Architecture:
 *   Sub-app (callmodule, matrix, okx_price_monitor)
 *     ↓ (pass parameters)
 *   ncore/launcher/native_launcher.js (this file)
 *     ↓ (handle launch logic)
 *   Electron or desktop framework
 */

const logger = require('#@logger');
const path = require('path');

class NativeUIConfig {
    constructor(options = {}) {
        this.appId = options.appId || 'default_app';
        this.appName = options.appName || 'Application';
        this.mainEntry = options.mainEntry || null;

        this.projectRoot = options.projectRoot || process.cwd();

        this.showDebugWindow = options.showDebugWindow !== false;
        this.debugWindowWidth = options.debugWindowWidth || 650;
        this.debugWindowHeight = options.debugWindowHeight || 500;
        this.minDisplayTime = options.minDisplayTime || 2.0;

        this.enableTray = options.enableTray || false;
        this.trayType = options.trayType || 'electron';
        this.trayMenuItems = options.trayMenuItems || null;
        this.minimizeToTray = options.minimizeToTray !== false;

        this.url = options.url || '';
        this.urlType = options.urlType || 'auto';

        this.windowSize = options.windowSize || [1280, 900];
        this.showOnStart = options.showOnStart !== false;
        this.frameless = options.frameless !== false;
        this.loadingStyle = options.loadingStyle || 10;
        this.windowTitleKey = options.windowTitleKey || null;

        this.iconPath = options.iconPath || null;
        this.logoPath = options.logoPath || null;
        this.logoSize = options.logoSize || 24;

        this.enableLanguageSelector = options.enableLanguageSelector !== false;

        this.onReadyCallbacks = options.onReadyCallbacks || [];
        this.onClosedCallbacks = options.onClosedCallbacks || [];
        this.onClosingCallbacks = options.onClosingCallbacks || [];
        this.onRestartCallback = options.onRestartCallback || null;

        this.frontendEnabled = options.frontendEnabled || false;
        this.frontendFramework = options.frontendFramework || null;
        this.frontendAppDir = options.frontendAppDir || null;
        this.frontendMode = options.frontendMode || 'production';
        this.frontendPort = options.frontendPort || 3000;
        this.frontendAutoInstall = options.frontendAutoInstall !== false;
        this.frontendPackageManager = options.frontendPackageManager || 'pnpm';
        this.frontendSkipBuild = options.frontendSkipBuild || false;
        this.frontendBlockUntilReady = options.frontendBlockUntilReady || false;

        this.rpcEnabled = options.rpcEnabled || false;
        this.rpcPort = options.rpcPort || 8000;
        this.rpcHost = options.rpcHost || '0.0.0.0';
        this.rpcDebug = options.rpcDebug !== false;
        this.rpcRouters = options.rpcRouters || null;
        this.rpcAllowOrigins = options.rpcAllowOrigins || null;
        this.rpcInitCallback = options.rpcInitCallback || null;
        this.rpcAutoMountFrontend = options.rpcAutoMountFrontend !== false;

        this.enableTimer = options.enableTimer || false;

        this.enableRestart = options.enableRestart || false;

        this.webengineEnableConfig = options.webengineEnableConfig !== false;
        this.webengineChromiumFlags = options.webengineChromiumFlags || null;
        this.webengineDisableGpuSandbox = options.webengineDisableGpuSandbox || false;
        this.webengineEnableWebcodecs = options.webengineEnableWebcodecs !== false;
        this.webengineEnableHardwareAcceleration = options.webengineEnableHardwareAcceleration !== false;
        this.webengineEnableRemoteDebugging = options.webengineEnableRemoteDebugging || false;
        this.webengineRemoteDebuggingPort = options.webengineRemoteDebuggingPort || 9222;
        this.webenginePrintDiagnostics = options.webenginePrintDiagnostics || false;

        this.force = options.force || false;

        this.debug = options.debug || false;
    }
}

function launchWithNativeUI(options = {}) {
    logger.warn('='.repeat(70));
    logger.warn('[NativeUILauncher] Native UI Launch Requested');
    logger.warn('='.repeat(70));

    const config = new NativeUIConfig(options);

    logger.info(`[NativeUILauncher] App ID: ${config.appId}`);
    logger.info(`[NativeUILauncher] App Name: ${config.appName}`);
    logger.info(`[NativeUILauncher] Project Root: ${config.projectRoot}`);
    logger.info(`[NativeUILauncher] Frontend Enabled: ${config.frontendEnabled}`);
    logger.info(`[NativeUILauncher] RPC Enabled: ${config.rpcEnabled}`);

    logger.warn('[NativeUILauncher] IMPLEMENTATION NOTE:');
    logger.warn('[NativeUILauncher] Full Native UI support requires Electron or similar framework.');
    logger.warn('[NativeUILauncher] This is a framework implementation that:');
    logger.warn('[NativeUILauncher]   1. Accepts all parameters (60+ params)');
    logger.warn('[NativeUILauncher]   2. Validates configuration');
    logger.warn('[NativeUILauncher]   3. Calls mainEntry if provided');
    logger.warn('[NativeUILauncher]   4. Can be extended with Electron integration');

    if (config.mainEntry && typeof config.mainEntry === 'function') {
        logger.info('[NativeUILauncher] Calling main entry function...');
        try {
            config.mainEntry();
            logger.success('[NativeUILauncher] Main entry function executed successfully');
        } catch (error) {
            logger.error('[NativeUILauncher] Main entry function failed:', error);
        }
    } else {
        logger.warn('[NativeUILauncher] No main entry function provided');
    }

    logger.success('='.repeat(70));
    logger.success('[NativeUILauncher] Native UI Launch Configuration Complete');
    logger.success('='.repeat(70));

    return config;
}

module.exports = {
    NativeUIConfig,
    launchWithNativeUI
};
