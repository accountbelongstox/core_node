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
 * Ncore Controller Routes - RPC route definitions
 */

const browserRoutes = require('./browser_routes');
const pageRoutes = require('./page_routes');
const documentRoutes = require('./document_routes');
const deepseekChatRoutes = require('./deepseek_chat_routes');
const okxMonitorRoutes = require('./okx_monitor_routes');
const tampermonkeyRoutes = require('./tampermonkey_routes');

module.exports = {
    browser: browserRoutes,
    page: pageRoutes,
    document: documentRoutes,
    deepseek: deepseekChatRoutes,
    okx: okxMonitorRoutes,
    tampermonkey: tampermonkeyRoutes
};
