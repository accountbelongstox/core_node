const config = require('./config');
const cache = require('./cache');
const sessionManager = require('./session_manager');
const requestManager = require('./request_manager');
const responseCache = require('./response_cache');
const { RPC_CONSTANTS } = require('#@global_vars');

module.exports = {
    config,
    cache,
    sessionManager,
    requestManager,
    responseCache,
    RPC_CONSTANTS,

    getConfig: config.getConfig,
    setConfig: config.setConfig,
    getPort: config.getPort,
    getHost: config.getHost,

    getCache: () => cache.defaultCache,
    createCache: cache.createCache,

    getSessionManager: () => sessionManager.defaultSessionManager,
    getRequestManager: () => requestManager.defaultRequestManager,
    getResponseCache: () => responseCache.defaultResponseCache,

    SessionManager: sessionManager.SessionManager,
    RequestManager: requestManager.RequestManager,
    ResponseCache: responseCache.ResponseCache,

    MSG_TYPES: RPC_CONSTANTS.MESSAGE_TYPES,
    ERROR_CODES: RPC_CONSTANTS.ERROR_CODES,
    EVENTS: RPC_CONSTANTS.EVENTS,
    DEFAULTS: RPC_CONSTANTS.DEFAULTS
};
