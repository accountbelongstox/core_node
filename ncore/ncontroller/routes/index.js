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
