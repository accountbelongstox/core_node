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