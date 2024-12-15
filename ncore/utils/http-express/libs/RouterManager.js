import logger from '#@utils_logger';

class RouterManager {
    constructor() {
        this.app = null;
        this.routes = new Map();
        this.middlewares = [];
    }

    setExpress(app) {
        if (this.app) {
            logger.warn('Express app is already set. Overwriting previous instance.');
        }
        this.app = app;
        logger.success('Express app has been set in RouterManager');
        return this;
    }

    addRouteHandler(path, handler, method = 'get') {
        if (!this.app) {
            throw new Error('Express app is not set. Call setExpress first.');
        }

        // Remove existing route if it exists
        if (this.routes.has(path)) {
            const layer = this.routes.get(path);
            const routeStack = this.app._router.stack;
            const index = routeStack.indexOf(layer);
            if (index > -1) {
                routeStack.splice(index, 1);
            }
        }

        // Add new route
        const layer = this.app[method.toLowerCase()](path, handler);
        this.routes.set(path, layer);
        logger.success(`Route added: ${method.toUpperCase()} ${path}`);
        return this;
    }

    addMiddleware(middleware) {
        if (!this.app) {
            throw new Error('Express app is not set. Call setExpress first.');
        }

        this.middlewares.push(middleware);
        this.app.use(middleware);
        logger.success('Middleware added');
        return this;
    }

    // Helper methods for different HTTP methods
    get(path, handler) {
        return this.addRouteHandler(path, handler, 'get');
    }

    post(path, handler) {
        return this.addRouteHandler     (path, handler, 'post');
    }

    put(path, handler) {
        return this.addRouteHandler(path, handler, 'put');
    }

    delete(path, handler) {
        return this.addRouteHandler(path, handler, 'delete');
    }

    // Get all registered routes
    getRoutes() {
        return Array.from(this.routes.keys());
    }

    // Get all registered middlewares
    getMiddlewares() {
        return this.middlewares;
    }

    // Clear all routes
    clearRoutes() {
        this.routes.clear();
        if (this.app && this.app._router) {
            this.app._router.stack = this.app._router.stack.filter(layer => {
                return layer.route === undefined;
            });
        }
        logger.info('All routes cleared');
        return this;
    }
}

export default new RouterManager(); 