const routes = require('./routes');

class BingDictApp {
    constructor() {
    }

    async start(server) {
        server.addRoute('/dict', routes.dict);
        console.log('Bing Dictionary app is starting...');
    }

}

module.exports = BingDictApp;