const wsRpc = require('./ws_rpc');
const httpRpc = require('./http_rpc');
const common = require('./common');
const client = require('./client');
const staticPathResolver = require('./http_rpc/libs/StaticPathResolver');
const SingletonRpcLauncher = require('./SingletonRpcLauncher');

module.exports = {
    ws: wsRpc,
    http: httpRpc,
    common,
    client,

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

    createClient: client.createClient,
    UnifiedRpcClient: client.UnifiedRpcClient,

    getConfig: common.getConfig,
    setConfig: common.setConfig,
    getCache: common.getCache,
    createCache: common.createCache,

    getSessionManager: common.getSessionManager,
    getRequestManager: common.getRequestManager,
    getResponseCache: common.getResponseCache,
    getSubAppManager: common.getSubAppManager,

    SubAppManager: common.SubAppManager,
    registerSubApp: (appName, options) => common.getSubAppManager().registerSubApp(appName, options),
    registerRoute: (appName, routeName, handler, options) => common.getSubAppManager().registerRoute(appName, routeName, handler, options),
    unregisterSubApp: (appName) => common.getSubAppManager().unregisterSubApp(appName),
    getSubAppStats: () => common.getSubAppManager().getStats(),

    getPort: common.getPort,
    getHost: common.getHost,

    staticPathResolver,
    resolveStaticPath: staticPathResolver.resolveStaticPath,
    getDefaultStaticPaths: staticPathResolver.getDefaultStaticPaths,
    getEnvironmentInfo: staticPathResolver.getEnvironmentInfo,

    RPC_CONSTANTS: common.RPC_CONSTANTS,
    MSG_TYPES: common.MSG_TYPES,
    ERROR_CODES: common.ERROR_CODES,
    EVENTS: common.EVENTS,
    DEFAULTS: common.DEFAULTS,

    SingletonRpcLauncher
};
