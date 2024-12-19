const sysarg = require('#@utils_native');
    // const httpMain = require('./http/main.js');
    const { getConfig } = require('./config/index.js');
    const httpMain = require('./http/main.js');
    const express = require('express');
    const admin = require('express-admin');
    const adminConfig = require('./config/admin_config.js');

    class Main {
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
    module.exports.Main = Main;
    module.exports = new Main();