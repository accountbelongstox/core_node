const EventEmitter = require('events');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const logger = require('#@logger');

const MSG_TYPES = {
    REQUEST: 'request',
    RESPONSE: 'response',
    EVENT: 'event',
    ERROR: 'error',
    PING: 'ping',
    PONG: 'pong',
    WELCOME: 'welcome',
    AUTH: 'auth',
    AUTH_RESPONSE: 'auth_response'
};

const ERROR_CODES = {
    ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    UNAUTHORIZED: 'UNAUTHORIZED',
    TIMEOUT: 'TIMEOUT',
    INVALID_PARAMS: 'INVALID_PARAMS'
};

class WsRpcServer extends EventEmitter {
    constructor(options = {}) {
        super();
        this.port = options.port || 8081;
        this.host = options.host || 'localhost';
        this.debug = options.debug || false;
        this.requestTimeout = options.requestTimeout || 30000;
        this.heartbeatInterval = options.heartbeatInterval || 30000;
        this.heartbeatTimeout = options.heartbeatTimeout || 10000;

        this.routes = new Map();
        this.clients = new Map();
        this.pendingRequests = new Map();
        this.server = null;
        this.heartbeatTimers = new Map();
    }

    async start() {
        return new Promise((resolve, reject) => {
            try {
                this.server = new WebSocket.Server({
                    host: this.host,
                    port: this.port
                });

                this.server.on('connection', (ws, req) => {
                    this._handleConnection(ws, req);
                });

                this.server.on('listening', () => {
                    logger.info(`WebSocket RPC Server listening on ${this.host}:${this.port}`);
                    resolve();
                });

                this.server.on('error', (error) => {
                    logger.error(`WebSocket server error: ${error.message}`);
                    reject(error);
                });
            } catch (error) {
                logger.error(`Failed to start WsRpcServer: ${error.message}`);
                reject(error);
            }
        });
    }

    async stop() {
        this.heartbeatTimers.forEach(timer => clearInterval(timer));
        this.heartbeatTimers.clear();

        this.clients.forEach((clientInfo, clientId) => {
            if (clientInfo.ws.readyState === WebSocket.OPEN) {
                clientInfo.ws.close();
            }
        });
        this.clients.clear();

        this.pendingRequests.forEach((pending, requestId) => {
            if (pending.timeout) {
                clearTimeout(pending.timeout);
            }
        });
        this.pendingRequests.clear();

        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(() => {
                    logger.info('WebSocket RPC Server stopped');
                    resolve();
                });
            });
        }
    }

    route(routeName, handler) {
        if (typeof handler !== 'function') {
            logger.error(`Handler for route '${routeName}' must be a function`);
            return this;
        }

        this.routes.set(routeName, handler);
        logger.debug(`Route registered: ${routeName}`);
        return this;
    }

    async callClient(routeName, params, clientId) {
        const clientInfo = this.clients.get(clientId);
        if (!clientInfo || clientInfo.ws.readyState !== WebSocket.OPEN) {
            throw new Error(`Client ${clientId} not connected`);
        }

        const requestId = uuidv4();
        const message = {
            type: MSG_TYPES.REQUEST,
            id: requestId,
            route: routeName,
            params: params,
            timestamp: Date.now()
        };

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error(`Request timeout: ${routeName}`));
            }, this.requestTimeout);

            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                timeout,
                route: routeName,
                clientId
            });

            this._send(clientInfo.ws, message);
            logger.debug(`Calling client route: ${routeName} (ID: ${requestId})`);
        });
    }

    async broadcast(message) {
        const messageStr = JSON.stringify(message);
        this.clients.forEach((clientInfo) => {
            if (clientInfo.ws.readyState === WebSocket.OPEN) {
                try {
                    clientInfo.ws.send(messageStr);
                } catch (error) {
                    logger.error(`Error broadcasting to ${clientInfo.clientId}: ${error.message}`);
                }
            }
        });
    }

    async triggerEvent(eventName, data, targetClientId = null) {
        const message = {
            type: MSG_TYPES.EVENT,
            event: eventName,
            data: data,
            timestamp: Date.now()
        };

        if (targetClientId) {
            const clientInfo = this.clients.get(targetClientId);
            if (clientInfo && clientInfo.ws.readyState === WebSocket.OPEN) {
                this._send(clientInfo.ws, message);
            }
        } else {
            await this.broadcast(message);
        }
    }

    getClients() {
        return Array.from(this.clients.keys());
    }

    _handleConnection(ws, req) {
        const clientId = uuidv4();
        const clientInfo = {
            clientId,
            ws,
            connected: true,
            lastPing: Date.now()
        };

        this.clients.set(clientId, clientInfo);
        logger.info(`Client connected: ${clientId}`);

        this._send(ws, {
            type: MSG_TYPES.WELCOME,
            client_id: clientId,
            timestamp: Date.now()
        });

        this._startHeartbeat(clientId);

        ws.on('message', async (data) => {
            await this._handleMessage(clientId, data);
        });

        ws.on('close', () => {
            this._handleDisconnect(clientId);
        });

        ws.on('error', (error) => {
            logger.error(`WebSocket error for client ${clientId}: ${error.message}`);
        });

        ws.on('pong', () => {
            clientInfo.lastPing = Date.now();
        });

        this.emit('connection', { clientId });
    }

    async _handleMessage(clientId, data) {
        try {
            const message = JSON.parse(data.toString());
            logger.debug(`Received message from ${clientId}: ${message.type}`);

            const clientInfo = this.clients.get(clientId);
            if (!clientInfo) {
                return;
            }

            clientInfo.lastPing = Date.now();

            switch (message.type) {
                case MSG_TYPES.REQUEST:
                    await this._handleRequest(clientId, message);
                    break;

                case MSG_TYPES.RESPONSE:
                    await this._handleResponse(clientId, message);
                    break;

                case MSG_TYPES.PONG:
                    break;

                case MSG_TYPES.PING:
                    this._send(clientInfo.ws, { type: MSG_TYPES.PONG, timestamp: Date.now() });
                    break;

                default:
                    logger.warn(`Unknown message type: ${message.type}`);
            }
        } catch (error) {
            logger.error(`Error handling message from ${clientId}: ${error.message}`);
        }
    }

    async _handleRequest(clientId, message) {
        const requestId = message.id;
        const route = message.route;
        const params = message.params;
        const clientInfo = this.clients.get(clientId);

        try {
            const handler = this.routes.get(route);
            if (!handler) {
                this._send(clientInfo.ws, {
                    type: MSG_TYPES.RESPONSE,
                    id: requestId,
                    success: false,
                    code: ERROR_CODES.ROUTE_NOT_FOUND,
                    error: `Route not found: ${route}`,
                    timestamp: Date.now()
                });
                return;
            }

            const result = await handler(params, { clientId, message });

            this._send(clientInfo.ws, {
                type: MSG_TYPES.RESPONSE,
                id: requestId,
                success: true,
                result: result,
                timestamp: Date.now()
            });
        } catch (error) {
            logger.error(`Route error (${route}): ${error.message}`);

            this._send(clientInfo.ws, {
                type: MSG_TYPES.RESPONSE,
                id: requestId,
                success: false,
                code: ERROR_CODES.INTERNAL_ERROR,
                error: error.message,
                timestamp: Date.now()
            });
        }
    }

    async _handleResponse(clientId, message) {
        const requestId = message.id;
        const pending = this.pendingRequests.get(requestId);

        if (!pending) {
            return;
        }

        if (pending.timeout) {
            clearTimeout(pending.timeout);
        }

        if (message.success) {
            pending.resolve(message.result);
        } else {
            const error = new Error(message.error || 'Unknown error');
            error.code = message.code;
            pending.reject(error);
        }

        this.pendingRequests.delete(requestId);
    }

    _handleDisconnect(clientId) {
        const clientInfo = this.clients.get(clientId);
        if (!clientInfo) {
            return;
        }

        const timer = this.heartbeatTimers.get(clientId);
        if (timer) {
            clearInterval(timer);
            this.heartbeatTimers.delete(clientId);
        }

        this.clients.delete(clientId);
        logger.info(`Client disconnected: ${clientId}`);

        this.emit('disconnect', { clientId });
    }

    _startHeartbeat(clientId) {
        const timer = setInterval(() => {
            const clientInfo = this.clients.get(clientId);
            if (!clientInfo) {
                clearInterval(timer);
                return;
            }

            if (clientInfo.ws.readyState === WebSocket.OPEN) {
                const timeSinceLastPing = Date.now() - clientInfo.lastPing;
                if (timeSinceLastPing > this.heartbeatTimeout) {
                    logger.warn(`Client ${clientId} heartbeat timeout, closing connection`);
                    clientInfo.ws.close();
                    return;
                }

                clientInfo.ws.ping();
            }
        }, this.heartbeatInterval);

        this.heartbeatTimers.set(clientId, timer);
    }

    _send(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
}

module.exports = WsRpcServer;
