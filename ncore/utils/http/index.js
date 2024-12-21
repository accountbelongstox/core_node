const StaticServer = require('./libs/StaticServer');

async function startStaticServer(config = null, port = 3000) {
    try {
        return await StaticServer.start(config, port);
    } catch (error) {
        console.error('Failed to start static server:', error);
        throw error;
    }
}

module.exports = {
    startStaticServer
};
