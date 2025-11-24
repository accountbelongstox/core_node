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
 * Platform-aware launcher for Ncore Module Caller
 *
 * Detects platform and launches appropriate mode:
 * - Windows: System tray with singleton detection
 * - Linux: Service mode (systemd compatible)
 */

const os = require('os');
const path = require('path');

const { initGlobalConfig } = require('../global_config');
const { createApp } = require('../app');
const { getInstance: getSingletonManager } = require('./singleton_manager');

const NCORE_ROOT = path.join(__dirname, '..', '..');
const singletonManager = getSingletonManager();

/**
 * Launch platform-aware server
 * @param {Object} options - Launch options
 */
async function launchPlatformAware(options = {}) {
    const host = options.host || '0.0.0.0';
    const port = options.port || 58000;
    const debug = options.debug || false;
    const noBrowser = options.noBrowser || false;
    const browserType = options.browserType || 'edge';
    const forceTakeover = options.forceTakeover || false;

    const platform = os.platform();

    console.log(`[Launcher] Detected platform: ${platform}`);
    console.log(`[Launcher] Host: ${host}, Port: ${port}`);
    console.log(`[Launcher] Browser: ${browserType}, Auto-launch: ${!noBrowser}`);

    // Singleton takeover logic
    const takeoverResult = await singletonManager.tryTakeover(port, '127.0.0.1');

    if (!takeoverResult.success) {
        if (takeoverResult.busy && !forceTakeover) {
            console.log(`[Launcher] Cannot start: ${takeoverResult.message}`);
            console.log('[Launcher] Use --force to override busy state');
            process.exit(1);
        } else if (!takeoverResult.busy) {
            console.log(`[Launcher] Warning: ${takeoverResult.message}`);
            console.log('[Launcher] Attempting to start anyway...');
        }
    }

    // Initialize global config (headless mode determined by platform_detector)
    initGlobalConfig({
        ncoreRoot: NCORE_ROOT,
        httpPort: port,
        host: host,
        debug: debug,
        autoLaunchBrowser: !noBrowser,
        browserType: browserType
    });

    if (platform === 'win32') {
        // Windows: Default to tray mode unless explicitly disabled
        const isInteractive = process.stdout.isTTY !== false;
        const noTray = process.env.NO_TRAY === 'true';

        console.log(`[Launcher] Interactive mode: ${process.stdout.isTTY} (using tray: ${!noTray})`);

        if (noTray) {
            // Tray explicitly disabled
            console.log('[Launcher] Tray mode disabled via NO_TRAY env var');
            await launchServiceMode(host, port);
        } else {
            // Try tray mode first
            try {
                const { launchWindowsTray } = require('./windows_tray');
                await launchWindowsTray({ host, port, debug });
            } catch (error) {
                // Fallback to service mode if tray fails
                console.log('[Launcher] Tray mode failed:', error.message);
                console.log('[Launcher] Falling back to service mode');
                await launchServiceMode(host, port);
            }
        }
    } else {
        // Linux/macOS: Service mode
        await launchServiceMode(host, port);
    }
}

/**
 * Launch in service mode (no tray)
 * @param {string} host - Host to bind to
 * @param {number} port - Port to bind to
 */
async function launchServiceMode(host, port) {
    console.log('[Launcher] Starting in service mode...');

    const app = await createApp();

    app.listen(port, host, () => {
        console.log(`[Launcher] Server running on http://${host}:${port}`);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('[Launcher] Received SIGINT, shutting down...');
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('[Launcher] Received SIGTERM, shutting down...');
        process.exit(0);
    });
}

module.exports = {
    launchPlatformAware,
    launchServiceMode
};
