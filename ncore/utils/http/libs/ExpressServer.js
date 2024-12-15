import expressWs from 'express-ws';
import bodyParser from 'body-parser';
import logger from '#@utils_logger';
import { WebSocketManager } from './WebSocketManager.js';
import { StaticServer } from './StaticServer.js';
import { ExpressBase } from './ExpressBase.js';

export class ExpressServer extends ExpressBase {
    #app = null;
    #wsManager = null;
    #staticServer = null;
    #port = 3000;
    #host = '0.0.0.0';
    #routers = new Map();

    constructor(options = {}) {
        super();
        this.#port = options.port || this.#port;
        this.#host = options.host || this.#host;
        this.#app = ExpressBase.getExpressApp();

        expressWs(this.#app);
        this.#wsManager = new WebSocketManager();
        this.#staticServer = new StaticServer(this.#app);
        this.#setupMiddleware();
        this.#setupWebSocket();
    }

    #setupMiddleware() {
        // Parse JSON bodies
        this.#app.use(bodyParser.json());
        this.#app.use(bodyParser.urlencoded({ extended: true }));

        // Basic logging middleware
        this.#app.use((req, res, next) => {
            logger.info(`${req.method} ${req.url}`);
            next();
        });

        // Error handling
        this.#app.use((err, req, res, next) => {
            logger.error('Express error:', err);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        });
    }

    #setupWebSocket() {
        this.#app.ws('/ws', (ws, req) => {
            const clientId = req.query.clientId || 'anonymous';
            this.#wsManager.addClient(clientId, ws);

            ws.on('message', (msg) => {
                try {
                    const data = JSON.parse(msg);
                    logger.debug('WebSocket message received:', data);
                } catch (error) {
                    logger.error('Invalid WebSocket message:', error);
                }
            });

            ws.on('close', () => {
                this.#wsManager.removeClient(clientId);
                logger.info(`Client ${clientId} disconnected`);
            });

            logger.info(`Client ${clientId} connected`);
        });
    }

    /**
     * Start the server
     * @returns {Promise<void>}
     */
    async start() {
        return new Promise((resolve, reject) => {
            try {
                this.#app.listen(this.#port, this.#host, () => {
                    logger.success(`Server started on http://${this.#host}:${this.#port}`);
                    resolve();
                });
            } catch (error) {
                logger.error('Failed to start server:', error);
                reject(error);
            }
        });
    }

    /**
     * Get the Express app instance
     * @returns {express.Application}
     */
    getApp() {
        return this.#app;
    }

    /**
     * Get the WebSocket manager instance
     * @returns {WebSocketManager}
     */
    getWSManager() {
        return this.#wsManager;
    }

    /**
     * Add static paths to server
     * @param {string|string[]|Object|Object[]} paths - Path or paths to serve
     * @param {string} [basePrefix='/'] - Base URL prefix for all paths
     * @returns {boolean} Success status
     */
    addStatic(paths, basePrefix = '/') {
        return this.#staticServer.addStatic(paths, basePrefix);
    }

    /**
     * Remove static path
     * @param {string} prefix 
     * @returns {boolean}
     */
    removeStatic(prefix) {
        return this.#staticServer.removeStatic(prefix);
    }

    /**
     * Get all static paths
     * @returns {Object[]}
     */
    getStaticPaths() {
        return this.#staticServer.getStaticPaths();
    }

    /**
     * Set router for specific path
     * @param {string} path Base path for router
     * @param {express.Router} router Express router instance
     * @returns {boolean} Success status
     */
    setRouter(path, router) {
        try {
            // Normalize path
            const normalizedPath = path.startsWith('/') ? path : `/${path}`;
            
            // If router path already exists, remove old one
            if (this.#routers.has(normalizedPath)) {
                logger.info(`Replacing existing router at path: ${normalizedPath}`);
                // Express doesn't provide direct method to remove middleware
            }

            // Add new router
            this.#app.use(normalizedPath, router);
            this.#routers.set(normalizedPath, router);
            
            logger.success(`Router set for path: ${normalizedPath}`);
            return true;
        } catch (error) {
            logger.error('Failed to set router:', error);
            return false;
        }
    }

    /**
     * Get all registered router paths
     * @returns {string[]} Array of router paths
     */
    getRouterPaths() {
        return Array.from(this.#routers.keys());
    }

    /**
     * Remove router for specific path
     * @param {string} path Router path to remove
     * @returns {boolean} Success status
     */
    removeRouter(path) {
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        if (this.#routers.has(normalizedPath)) {
            this.#routers.delete(normalizedPath);
            // Note: Express doesn't provide direct method to remove middleware
            // Need to rebuild the application to truly remove
            logger.info(`Marked router as removed for path: ${normalizedPath}`);
            return true;
        }
        return false;
    }
} 