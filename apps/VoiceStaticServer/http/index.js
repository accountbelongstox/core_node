const { appname } = require('#@/ncore/globalvars.js');
const { startExpressServer } = require('#@/ncore/utils/express/index.js');
const router = require('./router/index.js');

// Initialize all routes

class HttpMain {
    constructor() {
    }

    async start(config) {
        router.initializeRoutes();
        await startExpressServer(config)
        console.log(`appname ${appname}`);
    }
}

module.exports = new HttpMain();