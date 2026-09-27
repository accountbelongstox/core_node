/**
 * Frontend Management Module
 *
 * Exports frontend management components for Electron applications.
 * Ported from pycore/pyutils/native_ui/step9_frontend
 *
 * Usage:
 *   const { FrontendConfig, FrontendManager, startFrontendIfNeeded } = require('./frontend');
 */

const { FrontendConfig } = require('./config');
const { FrontendManager, startFrontendIfNeeded } = require('./manager');

module.exports = {
    FrontendConfig,
    FrontendManager,
    startFrontendIfNeeded
};
