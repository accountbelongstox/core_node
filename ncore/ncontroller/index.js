/**
 * Ncore Controller - Backend Service
 *
 * Provides backend services including:
 * - Browser management (Puppeteer)
 * - RPC route registration
 * - Platform-aware operations
 */

const { NcoreController } = require('./controller');
const { BrowserManager } = require('./browser_manager');
const { PlatformDetector } = require('./platform_detector');
const { PageCollector, pageCollector } = require('./page_collector');
const { ControllerManager, controllerManager } = require('./controller_manager');
const { DocumentController, documentController } = require('./controllers/document_controller');
const routes = require('./routes');

const VERSION = '1.0.0';

module.exports = {
    NcoreController,
    BrowserManager,
    PlatformDetector,
    PageCollector,
    pageCollector,
    ControllerManager,
    controllerManager,
    DocumentController,
    documentController,
    routes,
    VERSION
};
