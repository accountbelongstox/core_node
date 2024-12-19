const ExpressManager = require('#@/ncore/utils/http-express/libs/ExpressManager.js');
    const router = require('./router.js');

    class Main {
        constructor() {
        }

        async start() {
            router.initializeRoutes();
        }
    }

    module.exports = new Main();