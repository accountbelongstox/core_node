const HttpRpcServer = require('./HttpRpcServer');
const HttpRpcClient = require('./HttpRpcClient');
const ExpressServer = require('./ExpressServer');
const RouterManager = require('./libs/RouterManager');
const StaticServer = require('./libs/StaticServer');
const WsManager = require('./libs/WsManager');
const UploadTools = require('./libs/UploadTools');
const rpcCommon = require('../common');
const expressProvider = require('./provider/expressProvider');

let rpcServerInstance = null;
let expressServerInstance = null;

function getServerInstance(expressApp, options = {}) {
    if (!rpcServerInstance) {
        rpcServerInstance = new HttpRpcServer(expressApp, options);
    }
    return rpcServerInstance;
}

function createServer(expressApp, options = {}) {
    return new HttpRpcServer(expressApp, options);
}

function createClient(baseUrl, options = {}) {
    return new HttpRpcClient(baseUrl, options);
}

function startServer(expressApp, options = {}) {
    const server = getServerInstance(expressApp, options);
    server.start();
    return server;
}

function stopServer() {
    if (rpcServerInstance) {
        rpcServerInstance.stop();
        rpcServerInstance = null;
    }
}

function getExpressServerInstance(config = {}) {
    if (!expressServerInstance) {
        expressServerInstance = new ExpressServer(config);
    }
    return expressServerInstance;
}

function createExpressServer(config = {}) {
    return new ExpressServer(config);
}

async function startExpressServer(config = {}) {
    const server = getExpressServerInstance(config);
    await server.start(config);
    return server;
}

function stopExpressServer() {
    if (expressServerInstance) {
        expressServerInstance.stop();
        expressServerInstance = null;
    }
}

function getExpressApp() {
    return expressProvider.getExpressApp();
}

function getExpressRouter() {
    return RouterManager.getExpressRouter();
}

function broadcastWs(data) {
    return WsManager.broadcastWs(data);
}

function sendToWsClient(ws, data) {
    return WsManager.sendToWsClient(ws, data);
}

module.exports = {
    getServerInstance,
    createServer,
    createClient,
    startServer,
    stopServer,

    getExpressServerInstance,
    createExpressServer,
    startExpressServer,
    stopExpressServer,

    getExpressApp,
    getExpressRouter,
    broadcastWs,
    sendToWsClient,

    getConfig: rpcCommon.getConfig,
    setConfig: rpcCommon.setConfig,
    updateConfig: rpcCommon.setConfig,
    resetConfig: rpcCommon.reset,
    getCache: rpcCommon.getCache,
    createCache: rpcCommon.createCache,

    common: rpcCommon,

    HttpRpcServer,
    HttpRpcClient,
    ExpressServer,
    RouterManager,
    StaticServer,
    WsManager,
    UploadTools,
    expressProvider
};
