const { getConfig, updateConfig, resetConfig } = require('./config/index.js');
const { expressManager } = require('./libs/ExpressManager.js');
const StaticServer = require('./libs/StaticServer.js');
const WsManager = require('./libs/WsManager.js');
const RouterManager = require('./libs/RouterManager.js');
const RouterFinal = require('./libs/RouterFinal.js');

const startExpressServer = async (config) => {
    updateConfig(config);
    await RouterManager.start(config)
    await StaticServer.start(config)
    await WsManager.start(config)
    await expressManager.start();
    await RouterFinal.setFinalRoutes(config)
}

const broadcastWs = WsManager.broadcastWs
const sendToWsClient = WsManager.sendToWsClient

module.exports = { getConfig, updateConfig, broadcastWs, sendToWsClient, startExpressServer };