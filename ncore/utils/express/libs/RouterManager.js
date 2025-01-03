const logger = require('../logger/index.js');
const expressProvider = require('../provider/expressProvider');
const { getConfig } = require('../config');
const path = require('path');
const fs = require('fs');
const { APP_TEMPLATE_DIR } = require('#@/ncore/gvar/gdir.js');
const { pathToFileURL } = require('url');
const { readText } = require('../tool/reader.js');
const app = expressProvider.getExpressApp()

function findFirstAvailableFile(filePaths) {
    for (let filePath of filePaths) {
        const resolvedPath = path.resolve(filePath);
        if (fs.existsSync(resolvedPath)) {
            return resolvedPath;
        }
    }
    return null;
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

    afterSetDefaultPath() {
        const notFoundPage = findFirstAvailableFile([
            path.join(APP_TEMPLATE_DIR, '404.html'),
            path.join(__dirname, '../template/404.html')
        ])
        const forbiddenPage = findFirstAvailableFile([
            path.join(APP_TEMPLATE_DIR, '403.html'),
            path.join(__dirname, '../template/403.html')
        ])
        app.use((req, res, next) => {
            res.status(404).sendFile(fs.existsSync(notFoundPage) ? notFoundPage : path.join(APP_TEMPLATE_DIR, '404.html'));
        });
        app.use((req, res, next) => {
            res.status(403).sendFile(fs.existsSync(forbiddenPage) ? forbiddenPage : path.join(APP_TEMPLATE_DIR, '403.html'));
        });
        logger.success('404 and 403 pages setup.');
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
        if (!app) {
            throw new Error('Express app is not set. Call setExpress first.');
        }

        if (this.routes.has(path)) {
            const layer = this.routes.get(path);
            const routeStack = app._router.stack;
            const index = routeStack.indexOf(layer);
            if (index > -1) {
                routeStack.splice(index, 1);
            }
        }

        const layer = app[method.toLowerCase()](path, handler);
        this.routes.set(path, layer);
        logger.success(`Route added: ${method.toUpperCase()} ${path}`);
        return this;
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
        this.afterSetDefaultPath()
        this.printRoutes()
    }
}

module.exports = new RouterManager();