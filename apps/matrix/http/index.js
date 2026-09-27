/**
 * Matrix HTTP Service
 *
 * Initializes and manages the HTTP/RPC server for Matrix application.
 * Uses ncore's unified RPC system.
 *
 * Ported from pyapps/matrix HTTP service architecture.
 */

const logger = require('#@logger');
const rpc = require('#@ncore/utils/rpc/index.js');
const router = require('./router.js');

class MatrixHttpService {
    constructor() {
        this.expressServer = null;
        this.started = false;
    }

    async start(config) {
        if (this.started) {
            logger.warn('[Matrix HTTP] Service already started');
            return;
        }

        if (!config) {
            config = require('../config/index.js');
        }

        logger.info('[Matrix HTTP] Initializing HTTP service...');

        const rpcConfig = config.getRpcConfig();
        this.expressServer = rpc.createExpressServer(rpcConfig);

        router.initializeRoutes(this.expressServer);

        await this.expressServer.start();

        this.started = true;
        logger.success(`[Matrix HTTP] Service started on ${rpcConfig.host}:${rpcConfig.port}`);
    }

    async stop() {
        if (!this.started) {
            return;
        }

        logger.info('[Matrix HTTP] Stopping HTTP service...');

        if (this.expressServer && typeof this.expressServer.stop === 'function') {
            await this.expressServer.stop();
        }

        this.started = false;
        logger.success('[Matrix HTTP] Service stopped');
    }

    getExpressServer() {
        return this.expressServer;
    }
}

module.exports = new MatrixHttpService();
