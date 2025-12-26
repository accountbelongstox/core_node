const logger = require('#@logger');
const { SERVICE_STARTERS, THREAD_REGISTRY } = require('./registry');

let _restartHandlersRegistered = false;

function _registerBuiltinHandlers() {
    if (_restartHandlersRegistered) {
        return;
    }

    logger.info('[BuiltInHandlers] Registering built-in event handlers...');

    try {
        const threadBus = require('#@thread_bus');

        function handleAppRestart(eventData) {
            const reason = eventData.reason || 'Restart requested';
            logger.warn(`[BuiltInHandlers] Restart requested: ${reason}`);

            threadBus._restartRequested = true;

            if (!threadBus.isShutdownRequested()) {
                logger.info('[BuiltInHandlers] Initiating shutdown for restart...');
                threadBus.requestShutdown({
                    reason: `Restart: ${reason}`,
                    executeHandlers: true
                });
            }
        }

        threadBus.registerEventHandler('app.restart', handleAppRestart, { priority: 1 });

        _restartHandlersRegistered = true;
        logger.success('[BuiltInHandlers] Built-in event handlers registered');
    } catch (error) {
        logger.warn('[BuiltInHandlers] THREAD_BUS not available, skipping built-in handlers');
    }
}

function startHeartbeat(config) {
    _registerBuiltinHandlers();

    logger.info('[heartbeat] Starting Unified Heartbeat System...');

    try {
        const { initializeHeartbeatSystem } = require('#@ncore/heartbeat');

        const instance = initializeHeartbeatSystem();
        instance.start();

        function stopHeartbeat() {
            logger.info('[heartbeat] Stopping Heartbeat System...');
            if (instance && typeof instance.stop === 'function') {
                instance.stop();
            }
            logger.success('[heartbeat] Heartbeat System stopped');
        }

        const threadBus = require('#@thread_bus');
        const priority = THREAD_REGISTRY['heartbeat'].shutdown_priority;
        threadBus.registerShutdownHandler(stopHeartbeat, priority, 'heartbeat');

        logger.success('[heartbeat] Unified Heartbeat System started');
        return instance;

    } catch (error) {
        logger.error('[heartbeat] Failed to start heartbeat:', error);
        return null;
    }
}

function startRpcV2(config) {
    const port = config.port || 58100;
    const host = config.host || '0.0.0.0';
    const debug = config.debug || false;
    const fastAPIRouters = config.fastapi_routers || [];
    const staticMounts = config.static_mounts || [];
    const initCallback = config.init_callback;

    logger.info(`[rpc_v2] Starting RPC v2 Server on ${host}:${port}...`);
    if (fastAPIRouters.length > 0) {
        logger.info(`[rpc_v2] Will register ${fastAPIRouters.length} router(s)`);
    }
    if (staticMounts.length > 0) {
        logger.info(`[rpc_v2] Will mount ${staticMounts.length} static directory(ies)`);
    }

    try {
        const rpc = require('#@ncore/utils/rpc');
        const expressServer = rpc.createExpressServer({
            port,
            host,
            basePath: '/rpc'
        });

        expressServer.start().then(() => {
            logger.success(`[rpc_v2] RPC v2 Server started on ${host}:${port}`);
            logger.info(`[rpc_v2] HTTP: http://${host}:${port}/rpc/<route>`);
            logger.info(`[rpc_v2] WebSocket: ws://${host}:${port}/rpc/ws`);
        }).catch(err => {
            logger.error('[rpc_v2] Failed to start RPC v2:', err);
        });

        if (initCallback && typeof initCallback === 'function') {
            logger.info('[rpc_v2] Calling initialization callback...');
            initCallback(expressServer);
            logger.success('[rpc_v2] Initialization callback completed');
        }

        function stopRpcV2() {
            logger.info('[rpc_v2] Stopping RPC v2 Server...');
            if (expressServer && typeof expressServer.stop === 'function') {
                expressServer.stop();
            }
            logger.success('[rpc_v2] RPC v2 Server stopped');
        }

        try {
            const threadBus = require('#@thread_bus');
            const priority = THREAD_REGISTRY['rpc_v2'].shutdown_priority;
            threadBus.registerShutdownHandler(stopRpcV2, priority, 'rpc_v2');
        } catch (error) {
            logger.warn('[rpc_v2] THREAD_BUS not available, shutdown handler not registered');
        }

        return expressServer;

    } catch (error) {
        logger.error('[rpc_v2] Failed to start RPC v2:', error);
        return null;
    }
}

function startSpeech(config) {
    const mode = config.mode || 'single';
    const micLanguage = config.mic_language || 'zh-CN';
    const systemLanguage = config.system_language || 'en-US';
    const daemon = config.daemon !== false;

    logger.info(`[speech] Starting Speech Service (mode: ${mode})...`);
    logger.warn('[speech] Speech service not yet implemented for Node.js');
    return null;
}

function startUi(config) {
    logger.info('[ui] Starting UI Service...');
    logger.warn('[ui] UI service not yet implemented for Node.js');
    return null;
}

function startElectronUI(config) {
    logger.info('[electron_ui] Starting Electron UI Service...');

    try {
        const { launchElectronApp } = require('#@ncore/utils/electron');

        let result = null;

        launchElectronApp(config).then((launchResult) => {
            result = launchResult;
            logger.success('[electron_ui] Electron UI Service started');

            const threadBus = require('#@thread_bus');
            const priority = THREAD_REGISTRY['electron_ui'].shutdown_priority;

            function stopElectronUI() {
                logger.info('[electron_ui] Stopping Electron UI Service...');
                if (launchResult.manager && typeof launchResult.manager.cleanup === 'function') {
                    launchResult.manager.cleanup();
                }
                if (launchResult.portManager) {
                    launchResult.portManager.releaseAllPorts();
                }
                logger.success('[electron_ui] Electron UI Service stopped');
            }

            threadBus.registerShutdownHandler(stopElectronUI, priority, 'electron_ui');
        }).catch(error => {
            logger.error('[electron_ui] Failed to initialize:', error);
        });

        return { launching: true };
    } catch (error) {
        logger.error('[electron_ui] Failed to start Electron UI:', error);
        return null;
    }
}

function startTray(config) {
    logger.info('[tray] Starting System Tray...');
    logger.warn('[tray] Tray service not yet implemented for Node.js');
    return null;
}

SERVICE_STARTERS['heartbeat'] = startHeartbeat;
SERVICE_STARTERS['rpc_v2'] = startRpcV2;
SERVICE_STARTERS['speech'] = startSpeech;
SERVICE_STARTERS['ui'] = startUi;
SERVICE_STARTERS['electron_ui'] = startElectronUI;
SERVICE_STARTERS['tray'] = startTray;

module.exports = {
    startHeartbeat,
    startRpcV2,
    startSpeech,
    startUi,
    startElectronUI,
    startTray
};
