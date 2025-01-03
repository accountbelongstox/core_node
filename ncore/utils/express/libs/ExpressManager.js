const logger = require('#@utils_logger');
const expressProvider = require('../provider/expressProvider');
const { getConfig } = require('../config');
const app = expressProvider.getExpressApp()

class ExpressManager {
    constructor() {
    }

    async start(port) {
        this.config = await getConfig();

        const serverPort = port || this.config.HTTP_PORT;
        const serverHost = this.config.HTTP_HOST;


        const wsEnable = expressProvider.getWsToken()
        if(wsEnable){

        }
        
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

const expressManager = new ExpressManager();
module.exports = { expressManager };

