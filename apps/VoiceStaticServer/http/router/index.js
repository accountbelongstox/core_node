const RouterManager = require('#@/ncore/utils/express/libs/RouterManager.js');

class RouteInitializer {
    static initializeRoutes() {
        RouterManager.api('/test', (req, res) => {
            return {
                success: true,
                message: 'Test route working!',
                timestamp: new Date().toISOString(),
            }
        });

    }
}

module.exports = RouteInitializer;
