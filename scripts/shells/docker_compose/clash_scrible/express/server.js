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