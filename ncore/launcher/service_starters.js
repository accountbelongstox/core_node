/**
 * Service Starters Registry
 *
 * Central registry for all service starter functions.
 * 1:1 port from pycore/pythreadpool/service_starters.py
 *
 * Each service starter is responsible for:
 * - Initializing the service with provided config
 * - Returning the service instance
 * - Handling errors gracefully
 */

const logger = require('#@logger');
const { resolveBindHost } = require('#@foundation/common/local_rpc_guard.js');

const SERVICE_STARTERS = {};

function startHeartbeat(config) {
    logger.info('[ServiceStarter] Starting heartbeat service...');
    try {
        const threadBus = require('#@thread_bus');
        if (threadBus && threadBus.getHeartbeatSystem) {
            const heartbeat = threadBus.getHeartbeatSystem();
            logger.success('[ServiceStarter] Heartbeat service started');
            return heartbeat;
        }
        logger.warn('[ServiceStarter] Heartbeat system not available in THREAD_BUS');
        return null;
    } catch (error) {
        logger.error('[ServiceStarter] Failed to start heartbeat:', error);
        return null;
    }
}

function startRpcV2(config) {
    logger.info('[ServiceStarter] Starting RPC v2 service...');
    try {
        const rpc = require('#@ncore/utils/rpc/index.js');
        const expressServer = rpc.createExpressServer({
            port: config.port || 58100,
            host: resolveBindHost(config.host),
            basePath: '/rpc'
        });

        expressServer.start().then(() => {
            logger.success(`[ServiceStarter] RPC v2 service started on ${config.host}:${config.port}`);
        }).catch(err => {
            logger.error('[ServiceStarter] Failed to start RPC v2:', err);
        });

        return expressServer;
    } catch (error) {
        logger.error('[ServiceStarter] Failed to start RPC v2:', error);
        return null;
    }
}

function startSpeech(config) {
    logger.info('[ServiceStarter] Starting speech service...');
    logger.warn('[ServiceStarter] Speech service not yet implemented for Node.js');
    return null;
}

function startUi(config) {
    logger.info('[ServiceStarter] Starting UI service...');
    logger.warn('[ServiceStarter] UI service not yet implemented for Node.js');
    return null;
}

function startTimer(config) {
    logger.info('[ServiceStarter] Starting timer service...');
    logger.warn('[ServiceStarter] Timer service not yet implemented for Node.js');
    return null;
}

function startElectronUI(config) {
    logger.info('[ServiceStarter] Starting Electron UI service...');
    try {
        const { launchElectronApp } = require('#@ncore/utils/electron');

        launchElectronApp(config).then((result) => {
            logger.success('[ServiceStarter] Electron UI service started');
            return result;
        }).catch(error => {
            logger.error('[ServiceStarter] Electron UI initialization failed:', error);
        });

        return { launching: true };
    } catch (error) {
        logger.error('[ServiceStarter] Failed to start Electron UI:', error);
        return null;
    }
}

SERVICE_STARTERS['heartbeat'] = startHeartbeat;
SERVICE_STARTERS['rpc_v2'] = startRpcV2;
SERVICE_STARTERS['speech'] = startSpeech;
SERVICE_STARTERS['ui'] = startUi;
SERVICE_STARTERS['timer'] = startTimer;
SERVICE_STARTERS['electron_ui'] = startElectronUI;

function registerServiceStarter(name, starterFunc) {
    if (typeof starterFunc !== 'function') {
        logger.error(`[ServiceStarter] Invalid starter function for service: ${name}`);
        return false;
    }

    SERVICE_STARTERS[name] = starterFunc;
    logger.info(`[ServiceStarter] Registered service starter: ${name}`);
    return true;
}

function getServiceStarter(name) {
    return SERVICE_STARTERS[name] || null;
}

function getAllServiceNames() {
    return Object.keys(SERVICE_STARTERS);
}

module.exports = {
    SERVICE_STARTERS,
    registerServiceStarter,
    getServiceStarter,
    getAllServiceNames,
    startHeartbeat,
    startRpcV2,
    startSpeech,
    startUi,
    startTimer,
    startElectronUI
};
