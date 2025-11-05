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

let serverInstance = null;

function getServerInstance(expressApp, options = {}) {
    if (!serverInstance) {
        serverInstance = new HttpRpcServer(expressApp, options);
    }
    return serverInstance;
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
    if (serverInstance) {
        serverInstance.stop();
        serverInstance = null;
    }
}

module.exports = {
    getServerInstance,
    createServer,
    createClient,
    startServer,
    stopServer,

    HttpRpcServer,
    HttpRpcClient
};
