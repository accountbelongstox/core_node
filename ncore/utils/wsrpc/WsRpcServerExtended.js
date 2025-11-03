const http = require('http');
const url = require('url');
const WsRpcServer = require('./WsRpcServer');
const ResultCache = require('./ResultCache');
const logger = require('#@logger');

class WsRpcServerExtended extends WsRpcServer {
    constructor(options = {}) {
        super(options);

        this.httpPort = options.httpPort || this.port + 1;
        this.httpHost = options.httpHost || this.host;
        this.httpServer = null;
        this.enableHttp = options.enableHttp !== false;

        this.resultCache = new ResultCache({
            maxSize: options.cacheMaxSize || 10000,
            ttl: options.cacheTTL || 3600000,
            cleanupInterval: options.cacheCleanupInterval || 60000
        });

        this.requestMetadata = new Map();
    }

    async start() {
        await super.start();

        if (this.enableHttp) {
            await this.startHttpServer();
        }
    }

    async startHttpServer() {
        return new Promise((resolve, reject) => {
            try {
                this.httpServer = http.createServer((req, res) => {
                    this._handleHttpRequest(req, res);
                });

                this.httpServer.listen(this.httpPort, this.httpHost, () => {
                    logger.info(`HTTP API Server listening on ${this.httpHost}:${this.httpPort}`);
                    resolve();
                });

                this.httpServer.on('error', (error) => {
                    logger.error(`HTTP server error: ${error.message}`);
                    reject(error);
                });
            } catch (error) {
                logger.error(`Failed to start HTTP server: ${error.message}`);
                reject(error);
            }
        });
    }

    async stop() {
        await super.stop();

        if (this.httpServer) {
            return new Promise((resolve) => {
                this.httpServer.close(() => {
                    logger.info('HTTP API Server stopped');
                    resolve();
                });
            });
        }

        if (this.resultCache) {
            this.resultCache.stopCleanup();
            this.resultCache.clear();
        }

        this.requestMetadata.clear();
    }

    async callWithCallback(routeName, params, clientId, options = {}) {
        const requestId = options.requestId || this._generateRequestId();

        this.requestMetadata.set(requestId, {
            route: routeName,
            params,
            clientId,
            timestamp: Date.now(),
            status: 'pending',
            source: 'callback'
        });

        const result = await this.callClient(routeName, params, clientId);

        this.requestMetadata.set(requestId, {
            route: routeName,
            params,
            clientId,
            timestamp: Date.now(),
            status: 'completed',
            source: 'callback'
        });

        this.resultCache.set(requestId, result, {
            route: routeName,
            clientId,
            type: 'callback'
        });

        return { requestId, result };
    }

    async executeDelayedCallback(requestId, routeName, params, clientId, delayMs = 0) {
        this.requestMetadata.set(requestId, {
            route: routeName,
            params,
            clientId,
            timestamp: Date.now(),
            status: 'delayed',
            delayMs,
            source: 'delayed'
        });

        setTimeout(async () => {
            try {
                const result = await this.callClient(routeName, params, clientId);

                this.resultCache.set(requestId, result, {
                    route: routeName,
                    clientId,
                    type: 'delayed'
                });

                this.requestMetadata.set(requestId, {
                    route: routeName,
                    params,
                    clientId,
                    timestamp: Date.now(),
                    status: 'completed',
                    source: 'delayed'
                });

                await this.notifyClientOfResult(clientId, requestId, result);
            } catch (error) {
                logger.error(`Delayed callback error: ${error.message}`);

                this.resultCache.set(requestId, { error: error.message }, {
                    route: routeName,
                    clientId,
                    type: 'error'
                });

                this.requestMetadata.set(requestId, {
                    route: routeName,
                    params,
                    clientId,
                    timestamp: Date.now(),
                    status: 'error',
                    error: error.message,
                    source: 'delayed'
                });
            }
        }, delayMs);

        return requestId;
    }

    async notifyClientOfResult(clientId, requestId, result) {
        const clientInfo = this.clients.get(clientId);
        if (clientInfo && clientInfo.ws.readyState === 1) {
            await this.triggerEvent('result_ready', {
                requestId,
                result,
                timestamp: Date.now()
            }, clientId);
        }
    }

    getResult(requestId) {
        return this.resultCache.get(requestId);
    }

    hasResult(requestId) {
        return this.resultCache.has(requestId);
    }

    getRequestMetadata(requestId) {
        return this.requestMetadata.get(requestId);
    }

    _handleHttpRequest(req, res) {
        this._setCorsHeaders(res);

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname;

        if (pathname === '/api/result' && req.method === 'GET') {
            this._handleGetResult(req, res, parsedUrl.query);
        } else if (pathname === '/api/request' && req.method === 'POST') {
            this._handlePostRequest(req, res);
        } else if (pathname === '/api/status' && req.method === 'GET') {
            this._handleGetStatus(req, res, parsedUrl.query);
        } else if (pathname === '/api/health' && req.method === 'GET') {
            this._handleHealthCheck(req, res);
        } else if (pathname === '/api/stats' && req.method === 'GET') {
            this._handleGetStats(req, res);
        } else {
            this._sendJsonResponse(res, 404, {
                success: false,
                error: 'Endpoint not found'
            });
        }
    }

    _handleGetResult(req, res, query) {
        const requestId = query.requestId || query.id;

        if (!requestId) {
            this._sendJsonResponse(res, 400, {
                success: false,
                error: 'Missing requestId parameter'
            });
            return;
        }

        const cached = this.resultCache.get(requestId);
        const metadata = this.requestMetadata.get(requestId);

        if (cached) {
            this._sendJsonResponse(res, 200, {
                success: true,
                requestId,
                result: cached.result,
                metadata: cached.metadata,
                timestamp: cached.timestamp,
                status: metadata?.status || 'completed'
            });
        } else if (metadata && metadata.status === 'pending') {
            this._sendJsonResponse(res, 202, {
                success: false,
                requestId,
                status: 'pending',
                message: 'Request is still being processed',
                metadata
            });
        } else {
            this._sendJsonResponse(res, 404, {
                success: false,
                requestId,
                error: 'Result not found or expired'
            });
        }
    }

    _handlePostRequest(req, res) {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const { requestId, route, params, clientId, delay } = data;

                if (!route) {
                    this._sendJsonResponse(res, 400, {
                        success: false,
                        error: 'Missing route parameter'
                    });
                    return;
                }

                const finalRequestId = requestId || this._generateRequestId();

                if (delay && delay > 0) {
                    await this.executeDelayedCallback(
                        finalRequestId,
                        route,
                        params,
                        clientId,
                        delay
                    );

                    this._sendJsonResponse(res, 202, {
                        success: true,
                        requestId: finalRequestId,
                        status: 'scheduled',
                        message: 'Request scheduled for delayed execution',
                        delay
                    });
                } else {
                    const result = await this.callWithCallback(
                        route,
                        params,
                        clientId,
                        { requestId: finalRequestId }
                    );

                    this._sendJsonResponse(res, 200, {
                        success: true,
                        requestId: result.requestId,
                        result: result.result,
                        status: 'completed'
                    });
                }
            } catch (error) {
                logger.error(`HTTP request error: ${error.message}`);
                this._sendJsonResponse(res, 500, {
                    success: false,
                    error: error.message
                });
            }
        });
    }

    _handleGetStatus(req, res, query) {
        const requestId = query.requestId || query.id;

        if (!requestId) {
            this._sendJsonResponse(res, 400, {
                success: false,
                error: 'Missing requestId parameter'
            });
            return;
        }

        const metadata = this.requestMetadata.get(requestId);
        const hasResult = this.resultCache.has(requestId);

        if (metadata) {
            this._sendJsonResponse(res, 200, {
                success: true,
                requestId,
                status: metadata.status,
                hasResult,
                metadata
            });
        } else {
            this._sendJsonResponse(res, 404, {
                success: false,
                requestId,
                error: 'Request not found'
            });
        }
    }

    _handleHealthCheck(req, res) {
        this._sendJsonResponse(res, 200, {
            status: 'ok',
            timestamp: Date.now(),
            uptime: process.uptime(),
            websocket: {
                clients: this.clients.size,
                port: this.port
            },
            http: {
                port: this.httpPort
            },
            cache: this.resultCache.getStats()
        });
    }

    _handleGetStats(req, res) {
        this._sendJsonResponse(res, 200, {
            success: true,
            stats: {
                websocket: {
                    connectedClients: this.clients.size,
                    pendingRequests: this.pendingRequests.size
                },
                cache: this.resultCache.getStats(),
                requests: {
                    total: this.requestMetadata.size,
                    byStatus: this._getRequestsByStatus()
                }
            }
        });
    }

    _getRequestsByStatus() {
        const stats = {
            pending: 0,
            completed: 0,
            error: 0,
            delayed: 0
        };

        for (const metadata of this.requestMetadata.values()) {
            if (stats[metadata.status] !== undefined) {
                stats[metadata.status]++;
            }
        }

        return stats;
    }

    _sendJsonResponse(res, statusCode, data) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }

    _setCorsHeaders(res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    _generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

module.exports = WsRpcServerExtended;
