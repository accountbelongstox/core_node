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
 * Matrix Application - Main Entry Point
 *
 * Android Device Mirroring and Group Control System
 * Port from pyapps/matrix (Python) to ncore (Node.js)
 *
 * Features:
 * - ADB device management
 * - Screen mirroring (scrcpy)
 * - File transfer
 * - Group control
 * - Video streaming
 *
 * Launch Architecture:
 * - Uses ncore's unified Electron launcher (launchElectronApp)
 * - Auto-starts Vite dev server for frontend
 * - Initializes RPC v2 backend
 * - Creates system tray
 * - Enforces single instance
 *
 * Usage:
 *   node main.js app=matrix
 */

const { appname, isServer, isService } = require('#@global_vars');
const logger = require('#@logger');
const { launchElectronApp } = require('#@ncore/utils/electron/index.js');
const config = require('./config/index.js');
const http = require('./http/index.js');

let _launchResult = null;
let _httpStarted = false;

async function rpcInitCallback() {
    logger.info('[Matrix] RPC initialization callback invoked');

    await http.start(config);
    _httpStarted = true;

    logger.success('[Matrix] RPC v2 backend initialized');
    logger.success(`[Matrix] API Server: http://${config.WEB_HOST}:${config.WEB_PORT}/rpc`);
    logger.success(`[Matrix] Health Check: http://localhost:${config.WEB_PORT}/rpc/health`);
}

async function matrixMainEntry() {
    logger.info('[Matrix] Main entry callback invoked');
    logger.info('[Matrix] Application fully initialized and ready');
}

class MatrixMain {
    constructor() {
        this.started = false;
    }

    async start() {
        if (this.started) {
            logger.warn('[Matrix] Application already started');
            return;
        }

        logger.info(`=== Starting Matrix Application ===`);
        logger.info(`[Matrix] App name: ${appname}`);
        logger.info(`[Matrix] Is server: ${isServer}`);
        logger.info(`[Matrix] Is service: ${isService}`);
        logger.info(`[Matrix] ADB Path: ${config.ADB_PATH}`);
        logger.info(`[Matrix] Frontend Dir: ${config.FRONTEND_DIR}`);
        logger.info(`[Matrix] Frontend Port: ${config.FRONTEND_PORT}`);
        logger.info(`[Matrix] Frontend Mode: ${config.FRONTEND_MODE}`);
        logger.info(`[Matrix] Backend Port: ${config.WEB_PORT}`);

        try {
            _launchResult = await launchElectronApp({
                appName: 'Matrix Cloud',
                singleInstance: true,
                singleInstancePort: 58099,

                frontend: {
                    enabled: true,
                    framework: 'vite',
                    appDir: config.FRONTEND_DIR,
                    mode: config.FRONTEND_MODE,
                    port: config.FRONTEND_PORT,
                    host: '0.0.0.0',
                    autoInstall: false,
                    blockUntilReady: true,
                    packageManager: 'pnpm'
                },

                mainWindow: {
                    width: 1400,
                    height: 900,
                    minWidth: 1200,
                    minHeight: 700,
                    title: 'Matrix Cloud',
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true
                    }
                },

                systemTray: {
                    enabled: true,
                    title: 'Matrix Cloud',
                    tooltip: 'Matrix Cloud - Android Device Manager'
                },

                onFrontendReady: async (frontend) => {
                    logger.success(`[Matrix] Frontend ready at: ${frontend.getUrl()}`);
                    await rpcInitCallback();
                },

                onReady: async (manager) => {
                    logger.success('[Matrix] Electron manager ready');
                    await matrixMainEntry();
                }
            });

            this.started = true;
            logger.success(`=== Matrix Application Started Successfully ===`);
            logger.success(`[Matrix] Frontend URL: ${config.FRONTEND_URL}`);
            logger.success(`[Matrix] Backend API: http://${config.WEB_HOST}:${config.WEB_PORT}/rpc`);

        } catch (error) {
            logger.error('[Matrix] Failed to start application:', error);
            throw error;
        }
    }

    async stop() {
        if (!this.started) {
            return;
        }

        logger.info('[Matrix] Stopping application...');

        if (_httpStarted) {
            await http.stop();
            _httpStarted = false;
        }

        if (_launchResult && _launchResult.manager) {
            logger.info('[Matrix] Cleaning up Electron manager...');
            if (typeof _launchResult.manager.cleanup === 'function') {
                _launchResult.manager.cleanup();
            }
        }

        if (_launchResult && _launchResult.portManager) {
            logger.info('[Matrix] Releasing ports...');
            _launchResult.portManager.releaseAllPorts();
        }

        this.started = false;
        _launchResult = null;
        logger.success('[Matrix] Application stopped');
    }

    getLaunchResult() {
        return _launchResult;
    }

    isStarted() {
        return this.started;
    }
}

module.exports.MatrixMain = MatrixMain;
module.exports = new MatrixMain();
