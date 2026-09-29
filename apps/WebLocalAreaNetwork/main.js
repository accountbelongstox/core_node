const { appname,isServer,isService } = require('#@global_vars');
const config = require('./config/index.js');
const http = require('./http/index.js');
const logger = require('#@logger');

class Main {
    constructor() {
    }

    async start() {
        logger.info(`App name: ${appname}`);
        http.start(config)
    }
}
//work
// Export both the class and an instance
module.exports.Main = Main;
module.exports = new Main(); //work xxjxyjzzl.
//word 