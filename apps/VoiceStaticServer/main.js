const { appname } = require('#@/ncore/globalvars.js');
const config = require('./config/index.js');
const sysarg = require('#@utils_native');
// const httpMain = require('./http/main.js');
const { startExpressServer } = require('#@/ncore/utils/express/index.js');

// const adminConfig = require('./config/admin_config.js');

class Main {
    constructor() {
    }

    async start() {
        await startExpressServer(config)
        // const config = await getConfig();
        console.log(`appname ${appname}`);
        // const httpServer = await httpMain.start()
        // console.log(`start ...`)
        // console.log(httpServer);
        // const action = sysarg.getArg('action');
    }
}

// Export both the class and an instance
module.exports.Main = Main;
module.exports = new Main();