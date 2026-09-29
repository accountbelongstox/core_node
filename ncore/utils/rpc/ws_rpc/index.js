const WsRpcServer = require('./WsRpcServer');
const WsRpcClient = require('./WsRpcClient');
const rpcCommon = require('../common');

let serverInstance = null;

function getServerInstance(options = {}) {
    if (!serverInstance) {
        serverInstance = new WsRpcServer(options);
    }
    return serverInstance;
}

function createServer(options = {}) {
    return new WsRpcServer(options);
}

function createClient(url, options = {}) {
    return new WsRpcClient(url, options);
}

async function startServer(options = {}) {
    const server = getServerInstance(options);
    await server.start();
    return server;
}

async function stopServer() {
    if (serverInstance) {
        await serverInstance.stop();
        serverInstance = null;
    }
}

module.exports = {
    getServerInstance,
    createServer,
    createClient,
    startServer,
    stopServer,

    WsRpcServer,
    WsRpcClient,

    common: rpcCommon,
    getConfig: rpcCommon.getConfig,
    setConfig: rpcCommon.setConfig,
    getCache: rpcCommon.getCache,
    createCache: rpcCommon.createCache
};
