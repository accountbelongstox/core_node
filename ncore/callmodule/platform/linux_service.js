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
 * Linux Service Mode Launcher
 *
 * Launches server in service mode compatible with systemd.
 */

const path = require('path');

const { initGlobalConfig, getGlobalConfig } = require('../global_config');
const { createApp } = require('../app');

const NCORE_ROOT = path.join(__dirname, '..', '..');

let server = null;

/**
 * Launch Linux service mode
 * @param {Object} options - Launch options
 * @param {string} options.host - Host to bind to
 * @param {number} options.port - Port to bind to
 * @param {boolean} options.debug - Enable debug mode
 */
async function launchLinuxService(options = {}) {
    const host = options.host || '0.0.0.0';
    const port = options.port || 58000;
    const debug = options.debug || false;

    console.log('[Service] Starting Linux service mode...');

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
        console.log('[Service] Server started successfully');
        console.log(`[Service] Listening on ${host}:${port}`);

        // Notify systemd that we're ready (if running under systemd)
        if (process.env.NOTIFY_SOCKET) {
            notifySystemd('READY=1');
        }
    });

    // Handle shutdown signals
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
        console.log('[Service] Uncaught exception:', error.message);
        gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
        console.log('[Service] Unhandled rejection:', reason);
        gracefulShutdown('unhandledRejection');
    });
}

/**
 * Notify systemd of status
 * @param {string} message - Status message
 */
function notifySystemd(message) {
    try {
        const dgram = require('dgram');
        const socket = dgram.createSocket('unix_dgram');
        socket.send(message, process.env.NOTIFY_SOCKET, (error) => {
            socket.close();
            if (error) {
                console.log('[Service] Failed to notify systemd:', error.message);
            }
        });
    } catch (error) {
        console.log('[Service] Systemd notification not available');
    }
}

/**
 * Graceful shutdown
 * @param {string} signal - Signal that triggered shutdown
 */
function gracefulShutdown(signal) {
    console.log(`[Service] Received ${signal}, shutting down gracefully...`);

    // Notify systemd that we're stopping
    if (process.env.NOTIFY_SOCKET) {
        notifySystemd('STOPPING=1');
    }

    const config = getGlobalConfig();
    config.serverRunning = false;

    if (server) {
        server.close(() => {
            console.log('[Service] Server closed');
            process.exit(0);
        });

        // Force exit after timeout
        setTimeout(() => {
            console.log('[Service] Forcing exit after timeout');
            process.exit(1);
        }, 10000);
    } else {
        process.exit(0);
    }
}

module.exports = {
    launchLinuxService,
    gracefulShutdown
};
