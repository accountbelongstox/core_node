// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

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
