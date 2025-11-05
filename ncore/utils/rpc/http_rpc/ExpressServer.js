const logger = require('#@logger');
const expressProvider = require('./provider/expressProvider');
const rpcCommon = require('../common');
const StaticServer = require('./libs/StaticServer.js');
const WsManager = require('./libs/WsManager.js');
const RouterManager = require('./libs/RouterManager.js');
const UploadTools = require('./libs/UploadTools.js');
const { defaultResolver: staticPathResolver } = require('./libs/StaticPathResolver.js');
const http = require('http');
const os = require('os');

class ExpressServer {
    constructor(config = {}) {
        this.config = null;
        this.server = null;
        this.started = false;

        this.staticServer = StaticServer;
        this.wsManager = WsManager;
        this.routerManager = RouterManager;
        this.uploadTools = UploadTools;

        if (config) {
            rpcCommon.setConfig(config);
        }

        this.app = expressProvider.getExpressApp();
    }

    getLocalIp() {
        const interfaces = os.networkInterfaces();

        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }

        return '127.0.0.1';
    }

    async start(config) {
        if (this.started) {
            logger.warn('Express Server already started');
            return this.app;
        }

        if (config) {
            rpcCommon.setConfig(config);
        }

        this.config = rpcCommon.getConfig();

        const subAppManager = rpcCommon.getSubAppManager();

        this.config = subAppManager.getMergedConfig(this.config);

        if (!this.config.STATIC_PATHS) {
            logger.info('No STATIC_PATHS configured, using auto-detected paths');
            staticPathResolver.logEnvironmentInfo();
            this.config.STATIC_PATHS = staticPathResolver.getDefaultStaticPaths();
        }

        this.config.STATIC_PATHS = subAppManager.getMergedStaticPaths(this.config.STATIC_PATHS);

        if (subAppManager.subApps.size > 0) {
            logger.success(`Merged config from ${subAppManager.subApps.size} SubApps`);
        }

        await this.routerManager.start(this.config);
        await this.staticServer.start(this.config);
        await this.wsManager.start(this.config);

        const serverPort = this.config.HTTP_PORT || 3000;
        const serverHost = this.config.HTTP_HOST || '0.0.0.0';
        const localIp = this.getLocalIp();

        this.server = expressProvider.getServerApp();

        if (this.server) {
            await new Promise((resolve, reject) => {
                this.server.listen(serverPort, serverHost, (err) => {
                    if (err) {
                        logger.error('Failed to start server:' + err);
                        reject(err);
                    } else {
                        logger.success(`WebSocket server is running at ws://${localIp}:${serverPort}`);
                        logger.success(`HTTP server is running at http://${localIp}:${serverPort}`);
                        this.started = true;
                        resolve(this.server);
                    }
                });
            });
        } else {
            await new Promise((resolve, reject) => {
                try {
                    this.app.listen(serverPort, serverHost, () => {
                        const protocol = this.config.SSL_ENABLED ? 'HTTPS' : 'HTTP';
                        logger.success(`${protocol} Server running on ${serverHost}:${serverPort}`);
                        this.started = true;
                        resolve(this.app);
                    });
                } catch (error) {
                    logger.error('Failed to start server:', error);
                    reject(error);
                }
            });
        }

        return this.app;
    }

    stop() {
        if (!this.started) {
            logger.warn('Express Server not started');
            return;
        }

        this.wsManager.stop();

        if (this.server) {
            this.server.close(() => {
                logger.info('Express Server stopped');
            });
        }

        this.started = false;
    }

    getApp() {
        return this.app;
    }

    getServer() {
        return this.server;
    }

    getConfig() {
        return this.config;
    }

    getRouterManager() {
        return this.routerManager;
    }

    getStaticServer() {
        return this.staticServer;
    }

    getWsManager() {
        return this.wsManager;
    }

    getUploadTools() {
        return this.uploadTools;
    }

    broadcastWs(data) {
        return this.wsManager.broadcastWs(data);
    }

    sendToWsClient(ws, data) {
        return this.wsManager.sendToWsClient(ws, data);
    }

    getWebSocketServer() {
        return this.wsManager.getWebSocketServer();
    }

    getHttpServer() {
        return this.wsManager.getHttpServer();
    }
}

module.exports = ExpressServer;
