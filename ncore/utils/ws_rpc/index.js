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

const WsRpcServer = require('./WsRpcServer');
const WsRpcClient = require('./WsRpcClient');

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
    WsRpcClient
};
