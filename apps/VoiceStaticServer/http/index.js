const { appname } = require('#@/ncore/globalvars.js');
const { startExpressServer } = require('#@/ncore/utils/express/index.js');
const router = require('./router/index.js');
// Initialize all routes

class HttpMain {
    constructor() {
    }

    async start(config) {
        if(!config) config = require('../config/index.js');
        router.initializeRoutes();
        await startExpressServer(config)
    }
}

module.exports = new HttpMain();