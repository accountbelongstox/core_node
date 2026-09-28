/**
 * Matrix API Router
 *
 * Registers all Matrix RPC routes.
 * Ported from pyapps/matrix/api/main.py
 */

const logger = require('#@logger');
const rpc = require('#@ncore/utils/rpc/index.js');

class MatrixRouter {
    constructor() {
        this.initialized = false;
    }

    initializeRoutes(expressServer) {
        if (this.initialized) {
            logger.warn('[Matrix Router] Routes already initialized');
            return;
        }

        if (!expressServer) {
            logger.error('[Matrix Router] Express server not provided');
            return;
        }

        logger.info('[Matrix Router] Registering RPC routes...');

        const routerManager = expressServer.getRouterManager();
        this.registerHealthRoutes(routerManager);

        this.initialized = true;
        logger.success('[Matrix Router] All routes registered successfully');
    }

    registerHealthRoutes(routerManager) {
        const os = require('os');

        routerManager.api('/rpc/health', async (req, res) => {
            return {
                status: 'healthy',
                service: 'Matrix',
                version: '1.0.0',
                protocol: 'HTTP RPC',
                timestamp: new Date().toISOString()
            };
        });

        routerManager.api('/rpc/health/detailed', async (req, res) => {
            const cpus = os.cpus();
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;

            return {
                status: 'healthy',
                service: {
                    name: 'Matrix',
                    version: '1.0.0',
                    description: 'Android Device Mirroring and Group Control System',
                    protocol: 'HTTP RPC'
                },
                timestamp: new Date().toISOString(),
                system: {
                    platform: os.platform(),
                    arch: os.arch(),
                    node_version: process.version
                },
                resources: {
                    cpu: {
                        cores: cpus.length,
                        model: cpus[0]?.model || 'Unknown'
                    },
                    memory: {
                        total_mb: Math.round(totalMem / 1024 / 1024),
                        free_mb: Math.round(freeMem / 1024 / 1024),
                        used_mb: Math.round(usedMem / 1024 / 1024),
                        used_percent: Math.round((usedMem / totalMem) * 100)
                    },
                    uptime_seconds: Math.floor(os.uptime())
                }
            };
        });

        logger.info('[Matrix Router] Health routes registered');
    }
}

module.exports = new MatrixRouter();
