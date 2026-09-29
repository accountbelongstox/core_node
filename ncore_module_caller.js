/**
 * Ncore Module Caller - Legacy Entry Point
 *
 * This is a compatibility wrapper for systemd service and existing scripts.
 *
 * Platform-specific behavior:
 * - Windows: System tray + singleton detection
 * - Linux: Service mode (systemd compatible)
 *
 * For direct usage, use: node ncore_module_caller.js
 *
 * Usage:
 *     node ncore_module_caller.js              # Platform-aware mode
 */  

const path = require('path');
const serviceContract = require('#@/config/service_contract.js');
const { defaultBindHost } = require('#@foundation/common/local_rpc_guard.js');

const NCORE_ROOT = path.dirname(__filename);

// Hardcoded configuration
const CONFIG = {
    HOST: defaultBindHost(),
    PORT: serviceContract.port('ncore_backend'),
    BROWSER_TYPE: 'edge',
    AUTO_LAUNCH_BROWSER: true,
    DEBUG: false
};

/**
 * Run server with platform-aware launcher
 */
async function runServer() {
    const { launchPlatformAware } = require('./ncore/callmodule');
    await launchPlatformAware({
        host: CONFIG.HOST,
        port: CONFIG.PORT,
        debug: CONFIG.DEBUG,
        browserType: CONFIG.BROWSER_TYPE,
        noBrowser: !CONFIG.AUTO_LAUNCH_BROWSER
    });
}

// Main entry point
if (require.main === module) {
    runServer();
}

module.exports = {
    runServer,
    CONFIG
};
