const { RouterManager } = require('#@/ncore/utils/http-express/libs/ExpressManager.js');

    class VoiceRouter {
        initializeRoutes() {
            RouterManager.addRouteHandler(`/`, (req, res) => {
                res.send('Hello World');
            });
        }
    }

    // Export router instance
    module.exports = new VoiceRouter();