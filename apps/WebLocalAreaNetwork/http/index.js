const fs = require('fs');
const { appname } = require('#@global_vars');
const logger = require('#@logger');
const rpc = require('#@ncore/utils/rpc/index.js');
const router = require('./router.js');

class HttpMain {
    constructor() {
        this.expressServer = null;
    }

    async start(config) {
        if(!config) config = require('../config/index.js');

        if (config.SHARE_DIR) {
            try {
                fs.mkdirSync(config.SHARE_DIR, { recursive: true });
            } catch (error) {
                logger.error(`Cannot create share directory ${config.SHARE_DIR}: ${error.message}`);
            }
        }

        this.expressServer = rpc.createExpressServer({
            HTTP_PORT: config.HTTP_PORT || 3000,
            HTTP_HOST: config.HTTP_HOST,
            STATIC_PATHS: config.STATIC_PATHS,
            auth: { enabled: false }
        });

        router.initializeRoutes(this.expressServer.getRouterManager());

        await this.expressServer.start();
    }
}

module.exports = new HttpMain();