import { sysarg } from '#@utils_native';
// import httpMain from './http/main.js';
import { getConfig } from './config/index.js';
import httpMain from './http/main.js';
import express from 'express'
import admin from 'express-admin'
import adminConfig from './config/admin_config.js';


class Main   {
    constructor() {
    }

    async start() {
        express()
        .use(admin(adminConfig))
        .listen(3000)

        // const config = await getConfig();
        // console.log(config);
        // const httpServer = await httpMain.start()
        // console.log(`start ...`)
        // console.log(httpServer);
        // const action = sysarg.getArg('action');

    }
}

// Export both the class and an instance
export { Main };
export default new Main();
