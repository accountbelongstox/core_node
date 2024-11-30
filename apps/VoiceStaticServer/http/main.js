import { http } from '#@utils';
import router from './router.js';
import staticServer from './staticServer.js';
const {httpServer} = http

class Main   {
    constructor() {
    }

    async start() {
        staticServer.initialize()
        router.initializeRoutes();
        const httpConfig = await httpServer.startServer()
        console.log(`start ...`)
        console.log(httpConfig);
    }
}

export default new Main();

