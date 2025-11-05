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
