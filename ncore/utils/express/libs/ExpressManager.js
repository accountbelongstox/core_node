const logger = require('#@logger');
const expressProvider = require('../provider/expressProvider');
const { getConfig } = require('../config');

class ExpressManager {
    constructor() {
    }

    async start(port) {
        const app = expressProvider.getExpressApp()
        const server = expressProvider.getServerApp()
        this.config = await getConfig();
        const serverPort = port || this.config.HTTP_PORT;
        const serverHost = this.config.HTTP_HOST;
        const wsEnable = expressProvider.getWsToken()
        if (server) {
            return new Promise((resolve, reject) => {
                server.listen(serverPort, serverHost, (err) => {
                    if (err) {
                        logger.error('Failed to start server:'+err);
                        reject(err); // Reject the promise if there is an error
                    } else {
                        logger.success(`WebSocket server is running at ws://${serverHost}:${serverPort}`);
                        resolve(server); // Resolve the promise once the server starts successfully
                    }
                });
            });
        } else {
            return new Promise((resolve, reject) => {
                try {
                    app.listen(serverPort, serverHost, () => {
                        const protocol = this.config.SSL_ENABLED ? 'HTTPS' : 'HTTP';
                        logger.success(`${protocol} Server running on ${serverHost}:${serverPort}`);
                        resolve(app);
                    });
                } catch (error) {
                    logger.error('Failed to start server:', error);
                    reject(error);
                }
            });
        }

    }
}

const expressManager = new ExpressManager();
module.exports = { expressManager };

