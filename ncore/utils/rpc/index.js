const wsRpc = require('./ws_rpc');
const httpRpc = require('./http_rpc');
const common = require('./common');

module.exports = {
    ws: wsRpc,
    http: httpRpc,
    common,

    wsRpc,
    httpRpc,

    createWsServer: wsRpc.createServer,
    createWsClient: wsRpc.createClient,
    startWsServer: wsRpc.startServer,

    createHttpServer: httpRpc.createServer,
    createHttpClient: httpRpc.createClient,
    startHttpServer: httpRpc.startServer,

    createExpressServer: httpRpc.createExpressServer,
    startExpressServer: httpRpc.startExpressServer,

    getConfig: common.getConfig,
    setConfig: common.setConfig,
    getCache: common.getCache,
    createCache: common.createCache,

    getPort: common.getPort,
    getHost: common.getHost,

    RPC_CONSTANTS: common.RPC_CONSTANTS,
    MSG_TYPES: common.MSG_TYPES,
    ERROR_CODES: common.ERROR_CODES,
    EVENTS: common.EVENTS,
    DEFAULTS: common.DEFAULTS
};
