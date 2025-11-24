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
 *     node ncore_module_caller.js --host 0.0.0.0 --port 58000
 */

const path = require('path');

const NCORE_ROOT = path.dirname(__filename);

// Hardcoded configuration
const CONFIG = {
    HOST: '0.0.0.0',
    PORT: 58000,
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
