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

const WebServer = require('./web_server.js');

let webServerInstance = null;

async function startWebInterface(translationManager, config) {
    if (webServerInstance) {
        throw new Error('Web interface is already running');
    }

    webServerInstance = new WebServer(config, translationManager);
    await webServerInstance.start();
    return webServerInstance;
}

async function stopWebInterface() {
    if (webServerInstance) {
        await webServerInstance.stop();
        webServerInstance = null;
    }
}

async function getWebStatus() {
    if (!webServerInstance) {
        return { status: 'stopped', isRunning: false };
    }
    return await webServerInstance.getStatus();
}

async function restartWebInterface() {
    if (webServerInstance) {
        await webServerInstance.restart();
    }
}

module.exports = {
    startWebInterface,
    stopWebInterface,
    getWebStatus,
    restartWebInterface
};