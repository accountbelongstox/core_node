const { initializeExpress, startServer } = require('./init');
const setupRoutes = require('./routes');
const { startProxyServer } = require('../utils/proxy_node_utils');

class ProxyServer {
    constructor(port = 18180) {
        this.port = port;
        const { app, server } = initializeExpress();
        this.app = app;
        this.server = server;
        setupRoutes(this.app);
    }

    async start() {
        await startServer(this.server, this.port);
        await startProxyServer();
    }
}

if (require.main === module) {
    const server = new ProxyServer(8080);
    server.start();
}

module.exports = ProxyServer;