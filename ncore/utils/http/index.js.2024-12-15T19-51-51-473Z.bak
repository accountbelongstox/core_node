
import logger from '#@utils_logger';
import httpConfig from './config/HttpConfig.js';
import { ExpressServer } from './libs/ExpressServer.js';
import {
    ResponseCode,
    createResponse,
    successResponse,
    failureResponse,
    notFoundResponse,
    wrapResponse,
    errorHandler
} from './libs/ResponseUtil.js';
import { RouterBase } from './libs/RouterBase.js';

class HttpServer {
    #server = null;
    #staticPaths = [];

    async startServer() {
        try {
            // Get all configuration values
            const config = await httpConfig.getAll();
            logger.info('Starting HTTP server with configuration:', config);

            // Initialize Express server with config
            this.#server = new ExpressServer({
                port: config.HTTP_PORT,
                host: config.HTTP_HOST
            });

            if (this.#staticPaths.length > 0) {
                this.#staticPaths.forEach(({paths, basePrefix}) => {
                    this.#server.addStatic(paths, basePrefix);
                });
            }

            // Configure static paths if they exist
            if (config.HTTP_STATIC_PATHS && config.HTTP_STATIC_PATHS.length > 0) {
                this.#server.addStatic(config.HTTP_STATIC_PATHS, config.HTTP_STATIC_PREFIX);
            }

            // Start the server
            await this.#server.start();
            logger.success(`HTTP server is running on ${config.HTTP_HOST}:${config.HTTP_PORT}`);

            return true;
        } catch (error) {
            logger.error('Failed to start HTTP server:', error.message);
            return false;
        }
    }

    async stopServer() {
        try {
            if (this.#server) {
                // ExpressServer will handle closing WebSocket connections
                await this.#server.stop();
            }
            logger.success('HTTP server stopped');
            return true;
        } catch (error) {
            logger.error('Failed to stop HTTP server:', error.message);
            return false;
        }
    }

    getServer() {
        return this.#server;
    }

    getWebSocketManager() {
        return this.#server?.getWSManager() || null;
    }

    setRouter(path, router) {
        if (!this.#server) {
            logger.error('Server not initialized');
            return false;
        }
        return this.#server.setRouter(path, router);
    }

    getRouterPaths() {
        return this.#server?.getRouterPaths() || [];
    }

    removeRouter(path) {
        if (!this.#server) {
            logger.error('Server not initialized');
            return false;
        }
        return this.#server.removeRouter(path);
    }

    addStatic(paths, basePrefix = '/') {
        this.#staticPaths.push({paths, basePrefix});
    }
}
const httpServer = new HttpServer();
export {
    httpServer,
    httpConfig,
    ResponseCode,
    createResponse,
    successResponse,
    failureResponse,
    notFoundResponse,
    wrapResponse,
    errorHandler,
    RouterBase
};
