const logger = require('#@logger');
const { initializeWatcher } = require('../provider/WatcherProvider.js');
const { initMiddlewareDb } = require('../middware/dbmid_init.js');
class InitController {
    constructor() {
    }

    async initialize() {
        await initializeWatcher();
        await initMiddlewareDb();
    }
}

module.exports = new InitController();

