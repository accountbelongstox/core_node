const logger = require('#@/ncore/utils/logger/index.js');
const expressProvider = require('../provider/expressProvider');
const { processResponse } = require('../tool/response.js');
const { getConfig } = require('../config');
const path = require('path');
const fs = require('fs');
const { APP_TEMPLATE_DIR } = require('#@/ncore/gvar/gdir.js');
const { pathToFileURL } = require('url');
const { readText } = require('../tool/reader.js');
const app = expressProvider.getExpressApp()
const express = expressProvider.getExpress();
const router = express.Router();

function findFirstAvailableFile(filePaths) {
    for (let filePath of filePaths) {
        const resolvedPath = path.resolve(filePath);
        if (fs.existsSync(resolvedPath)) {
            return resolvedPath;
        }
    }
    return null;
}
function truncateUserAgent(userAgent) {
    const index = userAgent.indexOf(')');
    if (index !== -1) {
        return userAgent.slice(0, index + 1);  // Include the character ')' if needed
    }
    return userAgent;  // Return the full User-Agent if no ')' is found
}
function logRequest(req, res, next) {
    const startTime = Date.now();
    const method = req.method;
    const path = req.originalUrl;
    const ip = req.ip;
    const userAgent = req.get('User-Agent');
    const methodMarker = getMethodMarker(method);
    const truncateUserAgentString = truncateUserAgent(userAgent);

    logger.success(`${methodMarker} ${path} - IP: ${ip} - ${truncateUserAgentString}`);

    res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        if (responseTime > 3000) {
            logger.info(`${methodMarker} ${path} - ${responseTime}ms - IP: ${ip} - ${truncateUserAgentString}`);
        } else if (responseTime > 5000) {
            logger.warning(`${methodMarker} ${path} - ${responseTime}ms - IP: ${ip} - ${truncateUserAgentString}`);
        }
    });

    next(); // Proceed to the next middleware or handler
}

// Utility function to return method-specific markers for logging
function getMethodMarker(method) {
    switch (method.toUpperCase()) {
        case 'GET':
            return '[GET]';  // Green (you can change this to your own text format)
        case 'POST':
            return '[POST]';  // Blue
        case 'PUT':
            return '[PUT]';  // Yellow
        case 'DELETE':
            return '[DELETE]';  // Red
        default:
            return '[OTHER]';  // White for any other method
    }
}

const defaultRouter = {
    "/": findFirstAvailableFile([
        path.join(APP_TEMPLATE_DIR, 'index.html'),
        path.join(__dirname, '../template/index.html')
    ])
}

class RouterManager {
    constructor() {
        this.routes = new Map();
    }

    addDynamicRoutes() {
        for (let route in defaultRouter) {
            const filePathOrFunction = defaultRouter[route];
            console.log(`filePathOrFunction`, route, filePathOrFunction)
            if (typeof filePathOrFunction === 'function') {
                app.get(route, filePathOrFunction);
                logger.success(`Route ${route} added with dynamic function.`);
            } else {
                if (fs.existsSync(filePathOrFunction)) {
                    app.get(route, (req, res) => {
                        res.sendFile(filePathOrFunction, (err) => {
                            if (err) {
                                logger.error(`Error serving file: ${err}`);
                                res.status(500).send('Server Error');
                            }
                        });
                    });
                    logger.success(`Route ${route} served from file: ${filePathOrFunction}`);
                } else {
                    logger.error(`File not found for route ${route}: ${filePathOrFunction}`);
                }
            }
        }
    }

    printRoutes() {
        const routes = [];

        app._router.stack.forEach(middleware => {
            if (middleware.route) { // This is a route
                routes.push({
                    method: Object.keys(middleware.route.methods)[0].toUpperCase(),
                    path: middleware.route.path
                });
            }
        });

        console.log('Registered Routes:');
        routes.forEach(route => {
            console.log(`${route.method} ${route.path}`);
        });
    }

    addRouteHandler(path, handler, method = 'get') {
        if (!path || !handler) {
            logger.error('Path and handler are required');
            return;
        }

        const validMethods = ['get', 'post', 'put', 'delete'];
        if (!validMethods.includes(method.toLowerCase())) {
            logger.error(`Invalid HTTP method: ${method}`);
            return;
        }

        const logRequestResult = (req, res, next) => {
            logRequest(req, res, next);
            next(); // Proceed to the actual handler
        };

        router[method.toLowerCase()](path, logRequest, handler);
        this.routes.set(path, { handler, method });
        app.use('/', router);
        expressProvider.setExpressApp(app);
        logger.success(`Route added: [${method.toUpperCase()}] ${path}`);
    }

    get(path, handler) {
        return this.addRouteHandler(path, handler, 'get');
    }

    post(path, handler) {
        return this.addRouteHandler(path, handler, 'post');
    }

    put(path, handler) {
        return this.addRouteHandler(path, handler, 'put');
    }

    delete(path, handler) {
        return this.addRouteHandler(path, handler, 'delete');
    }

    api(path, handler, method = 'get') {
        return this.addRouteHandler(path, async (req, res, next) => {
            try {
                const result = await handler(req, res, next);
                res.json(processResponse(result));
            } catch (error) {
                logger.error(`Error in API route handler [${method.toUpperCase()}] ${path}:`, error);
                res.status(500).json({ error: 'Internal server error' + error });
            }
        }, method);
    }

    getExpressRouter() {
        return router;
    }

    getRoutes() {
        return Array.from(this.routes.keys());
    }

    clearRoutes() {
        this.routes.clear();
        if (app && app._router) {
            app._router.stack = app._router.stack.filter(layer => {
                return layer.route === undefined;
            });
        }
        logger.info('All routes cleared');
        return this;
    }

    async start(config) {
        this.addDynamicRoutes()
        this.printRoutes()
    }

}

module.exports = new RouterManager();