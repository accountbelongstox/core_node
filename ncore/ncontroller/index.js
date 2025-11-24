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
