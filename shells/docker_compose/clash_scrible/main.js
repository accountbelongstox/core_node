const ProxyServer = require('./express/server');

const port = 18100;
const server = new ProxyServer(port);
server.start();
