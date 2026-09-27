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