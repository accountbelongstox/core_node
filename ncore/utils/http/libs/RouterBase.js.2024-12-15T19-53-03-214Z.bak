
import logger from '#@utils_logger';
import { ExpressBase } from './ExpressBase.js';
import {
    successResponse,
    failureResponse,
    notFoundResponse,
    wrapResponse
} from './ResponseUtil.js';

export class RouterBase extends ExpressBase {
    #router = null;
    #routes = new Map();

    constructor() {
        super();
        this.#router = ExpressBase.createRouter();
        this.setupBaseRoutes();
        this.initializeRoutes();
    }

    /**
     * Mount router to express app
     * @param {string} basePath Base path for router
     * @returns {boolean} Success status
     */
    mount(basePath = '/') {
        try {
            const app = ExpressBase.getExpressApp();
            const normalizedPath = basePath.startsWith('/') ? basePath : `/${basePath}`;
            app.use(normalizedPath, this.#router);
            logger.success(`Router mounted at ${normalizedPath}`);
            return true;
        } catch (error) {
            logger.error('Failed to mount router:', error);
            return false;
        }
    }

    /**
     * Setup base routes that are available to all routers
     * @private
     */
    setupBaseRoutes() {
        // Health check endpoint
        this.addGet('/health', async () => ({
            status: 'healthy',
            timestamp: new Date().toISOString()
        }));

        // Version info endpoint
        this.addGet('/version', async () => ({
            version: process.env.npm_package_version || '1.0.0',
            node: process.version
        }));

        // Router info endpoint
        this.addGet('/routes', async () => ({
            routes: Array.from(this.#routes.keys()),
            count: this.#routes.size
        }));

        // Echo endpoint for testing
        this.addPost('/echo', async (req) => ({
            body: req.body,
            query: req.query,
            headers: req.headers
        }));
    }

    /**
     * Initialize routes - Should be overridden by child classes
     */
    initializeRoutes() {
        // To be implemented by child classes
        logger.warning('initializeRoutes not implemented');
    }

    /**
     * Get the Express router instance
     * @returns {express.Router}
     */
    getRouter() {
        return this.#router;
    }

    #removeExistingRoute(method, path) {
        const routeKey = `${method.toUpperCase()}:${path}`;
        if (this.#routes.has(routeKey)) {
            const layer = this.#router.stack.findIndex(l => 
                l.route && l.route.path === path && l.route.methods[method.toLowerCase()]
            );
            if (layer !== -1) {
                this.#router.stack.splice(layer, 1);
                logger.debug(`Removed existing route: ${routeKey}`);
            }
        }
        return routeKey;
    }

    #addRoute(method, path, handler, wrap = true) {
        const routeKey = this.#removeExistingRoute(method, path);
        const wrappedHandler = wrap ? wrapResponse(handler) : handler;
        
        this.#router[method.toLowerCase()](path, wrappedHandler);
        this.#routes.set(routeKey, wrappedHandler);
        logger.debug(`Added ${method} route: ${path}`);
    }

    /**
     * Add GET route
     * @param {string} path Route path
     * @param {Function} handler Route handler
     * @param {boolean} [wrap=true] Whether to wrap response in standard format
     */
    addGet(path, handler, wrap = true) {
        this.#addRoute('GET', path, handler, wrap);
    }

    /**
     * Add POST route
     * @param {string} path Route path
     * @param {Function} handler Route handler
     * @param {boolean} [wrap=true] Whether to wrap response in standard format
     */
    addPost(path, handler, wrap = true) {
        this.#addRoute('POST', path, handler, wrap);
    }

    /**
     * Add PUT route
     * @param {string} path Route path
     * @param {Function} handler Route handler
     * @param {boolean} [wrap=true] Whether to wrap response in standard format
     */
    addPut(path, handler, wrap = true) {
        this.#addRoute('PUT', path, handler, wrap);
    }

    /**
     * Add DELETE route
     * @param {string} path Route path
     * @param {Function} handler Route handler
     * @param {boolean} [wrap=true] Whether to wrap response in standard format
     */
    addDelete(path, handler, wrap = true) {
        this.#addRoute('DELETE', path, handler, wrap);
    }

    /**
     * Check if route exists
     * @param {string} method HTTP method
     * @param {string} path Route path
     * @returns {boolean}
     */
    hasRoute(method, path) {
        return this.#routes.has(`${method.toUpperCase()}:${path}`);
    }

    /**
     * Get all registered routes
     * @returns {string[]} Array of route paths with methods
     */
    getRoutes() {
        return Array.from(this.#routes.keys());
    }

    /**
     * Response helper methods
     */
    successResponse(data, message, code) {
        return successResponse(data, message, code);
    }

    failureResponse(message, data, code) {
        return failureResponse(message, data, code);
    }

    notFoundResponse(message, data) {
        return notFoundResponse(message, data);
    }

    /**
     * Add middleware to router
     * @param {Function} middleware Middleware function
     */
    useMiddleware(middleware) {
        this.#router.use(middleware);
        logger.debug('Added middleware to router');
    }
} 