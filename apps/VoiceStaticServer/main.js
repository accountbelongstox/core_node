const sysarg = require('#@utils_native');
// const httpMain = require('./http/main.js');
const { startStaticServer } = require('#@ncore/utils/http/index.js');

// const adminConfig = require('./config/admin_config.js');

class Main {
    constructor() {
    }

    async start() {
        startStaticServer()
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