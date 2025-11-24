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
 * Windows Tray Mode Launcher
 *
 * Launches server with system tray support and singleton detection for Windows.
 */

const path = require('path');
const net = require('net');

const { initGlobalConfig, getGlobalConfig } = require('../global_config');
const { createApp } = require('../app');
const { getInstance: getTrayLauncher } = require('../../utils/electron/TrayLauncher');
const { ncoreController } = require('../../ncontroller/controller');
const { getThreadBus } = require('#@thread_bus');

const NCORE_ROOT = path.join(__dirname, '..', '..');
const LOCK_PORT = 58099;
const threadBus = getThreadBus();

let server = null;
let lockServer = null;
let trayLauncher = null;

/**
 * Check if another instance is running
 * @returns {Promise<boolean>}
 */
function checkSingleton() {
    return new Promise((resolve) => {
        const client = net.createConnection({ port: LOCK_PORT }, () => {
            client.end();
            resolve(true); // Another instance is running
        });

        client.on('error', () => {
            resolve(false); // No other instance
        });
    });
}

/**
 * Create singleton lock
 * @returns {Promise<boolean>}
 */
function createLock() {
    return new Promise((resolve) => {
        lockServer = net.createServer();

        lockServer.on('error', (error) => {
            console.log('[Tray] Failed to create lock:', error.message);
            resolve(false);
        });

        lockServer.listen(LOCK_PORT, '127.0.0.1', () => {
            console.log('[Tray] Singleton lock acquired');
            resolve(true);
        });
    });
}

/**
 * Launch Windows tray mode
 * @param {Object} options - Launch options
 * @param {string} options.host - Host to bind to
 * @param {number} options.port - Port to bind to
 * @param {boolean} options.debug - Enable debug mode
 */
async function launchWindowsTray(options = {}) {
    const host = options.host || '0.0.0.0';
    const port = options.port || 58000;
    const debug = options.debug || false;

    console.log('[Tray] Starting Windows tray mode...');

    // Check singleton
    const isRunning = await checkSingleton();
    if (isRunning) {
        console.log('[Tray] Another instance is already running');
        console.log('[Tray] Sending focus request to existing instance');
        process.exit(0);
        return;
    }

    // Create lock
    const lockCreated = await createLock();
    if (!lockCreated) {
        console.log('[Tray] Failed to create singleton lock, continuing anyway');
    }

    // Initialize config
    initGlobalConfig({
        ncoreRoot: NCORE_ROOT,
        httpPort: port,
        host: host,
        debug: debug
    });

    // Create and start app
    const app = await createApp();

    server = app.listen(port, host, () => {
        const config = getGlobalConfig();
        console.log('[Tray] Server started successfully');
        console.log(`[Tray] Access URL: http://${config.localIp || host}:${port}`);

        // Register with ThreadBus
        threadBus.register('windows-tray-server', {
            priority: 90,
            onShutdown: async () => {
                console.log('[Tray] ThreadBus shutdown signal received');
                if (server) {
                    server.close();
                }
                if (lockServer) {
                    lockServer.close();
                }
            }
        });

        // Initialize Electron tray
        initElectronTray(host, port);
    });
}

/**
 * Initialize Electron tray
 * @param {string} host - Server host
 * @param {number} port - Server port
 */
async function initElectronTray(host, port) {
    console.log('[Tray] Initializing Electron tray...');

    const fs = require('fs');
    const trayIconPath = path.join(NCORE_ROOT, 'assets', 'tray-icon.png');
    let iconPath = trayIconPath;

    if (!fs.existsSync(iconPath)) {
        console.log('[Tray] Custom icon not found, using empty icon');
        iconPath = null;
    }

    const config = getGlobalConfig();
    const accessUrl = `http://${config.localIp || host}:${port}`;

    const trayConfig = {
        iconPath: iconPath,
        tooltip: 'Ncore Module Caller - Running',
        appTitle: 'Ncore Module Caller',
        frontendUrl: accessUrl,
        backendUrl: accessUrl
    };

    trayLauncher = getTrayLauncher();
    await trayLauncher.launch(trayConfig);

    // Register Electron tray with ThreadBus
    threadBus.register('electron-tray', {
        priority: 10,
        onShutdown: async () => {
            console.log('[Tray] Shutting down Electron tray...');
            if (trayLauncher) {
                await trayLauncher.shutdown();
            }
        }
    });

    // Register ncontroller with ThreadBus
    threadBus.register('ncontroller', {
        priority: 20,
        onShutdown: async () => {
            console.log('[Tray] Shutting down ncontroller...');
            try {
                await ncoreController.shutdown();
            } catch (error) {
                console.log('[Tray] Error shutting down controller:', error.message);
            }
        }
    });

    console.log('[Tray] Electron tray launched successfully');
}

/**
 * Show system notification (placeholder)
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 */
function showNotification(title, message) {
    // This is a placeholder for actual system tray notification
    // Can be implemented with node-notifier or similar package
    console.log(`[Tray] Notification: ${title} - ${message}`);
}

/**
 * Shutdown the server (legacy, now handled by ThreadBus)
 */
async function shutdown() {
    console.log('[Tray] Shutdown requested, delegating to ThreadBus...');
    await threadBus.shutdown('Manual shutdown');
    process.exit(0);
}

module.exports = {
    launchWindowsTray,
    checkSingleton,
    createLock
};
