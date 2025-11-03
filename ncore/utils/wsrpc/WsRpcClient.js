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

class WsRpcClient extends EventEmitter {
    constructor(url, options = {}) {
        super();
        this.url = url;
        this.debug = options.debug || false;
        this.ws = null;
        this.connected = false;
        this.authenticated = false;
        this.clientId = null;
        this.authToken = null;

        this.routes = new Map();
        this.pendingRequests = new Map();
        this.messageQueue = [];

        this.requestTimeout = options.requestTimeout || 30000;
        this.reconnect = options.reconnect !== undefined ? options.reconnect : true;
        this.reconnectInterval = options.reconnectInterval || 3000;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = options.maxReconnectAttempts || 10;

        this.heartbeatInterval = options.heartbeatInterval || 30000;
        this.heartbeatTimeout = options.heartbeatTimeout || 10000;
        this.enableHeartbeat = options.enableHeartbeat !== undefined ? options.enableHeartbeat : true;

        this.heartbeatTimer = null;
        this.heartbeatTimeoutTimer = null;

        this.requestInterceptors = [];
        this.responseInterceptors = [];
        this.errorInterceptors = [];

        this.onConnected = options.onConnected;
        this.onDisconnected = options.onDisconnected;
        this.onError = options.onError;
        this.onReconnecting = options.onReconnecting;
        this.onAuthenticated = options.onAuthenticated;
        this.onAuthFailed = options.onAuthFailed;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            try {
                logger.info(`Connecting to ${this.url}...`);
                this.ws = new WebSocket(this.url);

                this.ws.on('open', async () => {
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    logger.info('Connected to server');

                    await this._flushMessageQueue();

                    if (this.enableHeartbeat) {
                        this._startHeartbeat();
                    }

                    if (this.onConnected) {
                        await this.onConnected();
                    }

                    this.emit('connection', {});
                    resolve();
                });

                this.ws.on('message', async (data) => {
                    await this._handleMessage(data);
                });

                this.ws.on('close', async () => {
                    logger.warn('Connection closed');
                    this.connected = false;
                    this.authenticated = false;
                    this._stopHeartbeat();

                    if (this.onDisconnected) {
                        await this.onDisconnected();
                    }

                    this.emit('disconnect', {});

                    if (this.reconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                        await this._attemptReconnect();
                    }
                });

                this.ws.on('error', async (error) => {
                    logger.error(`WebSocket error: ${error.message}`);
                    if (this.onError) {
                        await this.onError(error);
                    }
                    reject(error);
                });

                this.ws.on('pong', () => {
                    if (this.heartbeatTimeoutTimer) {
                        clearTimeout(this.heartbeatTimeoutTimer);
                        this.heartbeatTimeoutTimer = null;
                    }
                });
            } catch (error) {
                logger.error(`Connection error: ${error.message}`);
                if (this.onError) {
                    this.onError(error);
                }
                reject(error);
            }
        });
    }

    async disconnect() {
        this.reconnect = false;
        this._stopHeartbeat();

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close();
        }

        this.connected = false;
        this.authenticated = false;

        this.pendingRequests.forEach((pending, requestId) => {
            if (pending.timeout) {
                clearTimeout(pending.timeout);
            }
            pending.reject(new Error('Connection closed'));
        });
        this.pendingRequests.clear();
    }

    async authenticate(credentials) {
        if (!this.connected) {
            throw new Error('Not connected to server');
        }

        const requestId = uuidv4();
        const message = {
            type: MSG_TYPES.AUTH,
            id: requestId,
            credentials: credentials,
            timestamp: Date.now()
        };

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('Authentication timeout'));
            }, this.requestTimeout);

            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                timeout,
                route: 'authenticate'
            });

            this._send(message);
        });
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

    async call(routeName, params = null) {
        if (!this.connected) {
            throw new Error('Not connected to server');
        }

        const requestId = uuidv4();
        let message = {
            type: MSG_TYPES.REQUEST,
            id: requestId,
            route: routeName,
            params: params,
            timestamp: Date.now()
        };

        if (this.authToken) {
            message.token = this.authToken;
        }

        for (const interceptor of this.requestInterceptors) {
            try {
                if (interceptor.onFulfilled) {
                    message = await interceptor.onFulfilled(message);
                }
            } catch (error) {
                if (interceptor.onRejected) {
                    message = await interceptor.onRejected(error);
                } else {
                    throw error;
                }
            }
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error(`Request timeout: ${routeName}`));
            }, this.requestTimeout);

            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                timeout,
                route: routeName
            });

            this._send(message);
            logger.debug(`Calling server route: ${routeName} (ID: ${requestId})`);
        });
    }

    addRequestInterceptor(onFulfilled, onRejected) {
        const interceptorId = this.requestInterceptors.length;
        this.requestInterceptors.push({
            id: interceptorId,
            onFulfilled,
            onRejected
        });
        return interceptorId;
    }

    addResponseInterceptor(onFulfilled, onRejected) {
        const interceptorId = this.responseInterceptors.length;
        this.responseInterceptors.push({
            id: interceptorId,
            onFulfilled,
            onRejected
        });
        return interceptorId;
    }

    addErrorInterceptor(handler) {
        const interceptorId = this.errorInterceptors.length;
        this.errorInterceptors.push({
            id: interceptorId,
            handler
        });
        return interceptorId;
    }

    removeInterceptor(type, interceptorId) {
        let interceptors;
        switch (type) {
            case 'request':
                interceptors = this.requestInterceptors;
                break;
            case 'response':
                interceptors = this.responseInterceptors;
                break;
            case 'error':
                interceptors = this.errorInterceptors;
                break;
            default:
                return;
        }

        const index = interceptors.findIndex(i => i.id === interceptorId);
        if (index !== -1) {
            interceptors.splice(index, 1);
        }
    }

    async _handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            logger.debug(`Received message: ${message.type}`);

            if (this.heartbeatTimeoutTimer) {
                clearTimeout(this.heartbeatTimeoutTimer);
                this.heartbeatTimeoutTimer = null;
            }

            switch (message.type) {
                case MSG_TYPES.WELCOME:
                    this.clientId = message.client_id;
                    logger.info(`Assigned client ID: ${this.clientId}`);
                    if (message.auth_required) {
                        logger.warn('Server requires authentication');
                    }
                    break;

                case MSG_TYPES.REQUEST:
                    await this._handleRequest(message);
                    break;

                case MSG_TYPES.RESPONSE:
                    await this._handleResponse(message);
                    break;

                case MSG_TYPES.EVENT:
                    await this._handleEvent(message);
                    break;

                case MSG_TYPES.ERROR:
                    logger.error(`Server error: ${message.error}`);
                    this.emit('error', message);
                    break;

                case MSG_TYPES.PING:
                    await this._handlePing(message);
                    break;

                case MSG_TYPES.AUTH_RESPONSE:
                    await this._handleAuthResponse(message);
                    break;

                default:
                    logger.warn(`Unknown message type: ${message.type}`);
            }
        } catch (error) {
            logger.error(`Error handling message: ${error.message}`);
            for (const interceptor of this.errorInterceptors) {
                try {
                    if (interceptor.handler) {
                        await interceptor.handler(error);
                    }
                } catch (handlerError) {
                    logger.error(`Error in error interceptor: ${handlerError.message}`);
                }
            }
        }
    }

    async _handleRequest(message) {
        const requestId = message.id;
        const route = message.route;
        const params = message.params;

        try {
            const handler = this.routes.get(route);
            if (!handler) {
                this._send({
                    type: MSG_TYPES.RESPONSE,
                    id: requestId,
                    success: false,
                    code: ERROR_CODES.ROUTE_NOT_FOUND,
                    error: `Route not found: ${route}`,
                    timestamp: Date.now()
                });
                return;
            }

            const result = await handler(params);

            this._send({
                type: MSG_TYPES.RESPONSE,
                id: requestId,
                success: true,
                result: result,
                timestamp: Date.now()
            });
        } catch (error) {
            logger.error(`Route error (${route}): ${error.message}`);

            this._send({
                type: MSG_TYPES.RESPONSE,
                id: requestId,
                success: false,
                code: ERROR_CODES.INTERNAL_ERROR,
                error: error.message,
                timestamp: Date.now()
            });
        }
    }

    async _handleResponse(message) {
        const requestId = message.id;
        const pending = this.pendingRequests.get(requestId);

        if (!pending) {
            return;
        }

        if (pending.timeout) {
            clearTimeout(pending.timeout);
        }

        try {
            if (message.success) {
                let result = message.result;

                for (const interceptor of this.responseInterceptors) {
                    try {
                        if (interceptor.onFulfilled) {
                            result = await interceptor.onFulfilled(result);
                        }
                    } catch (error) {
                        if (interceptor.onRejected) {
                            result = await interceptor.onRejected(error);
                        } else {
                            throw error;
                        }
                    }
                }

                pending.resolve(result);
            } else {
                const error = new Error(message.error || 'Unknown error');
                error.code = message.code;
                pending.reject(error);
            }

            this.pendingRequests.delete(requestId);
        } catch (error) {
            pending.reject(error);
            this.pendingRequests.delete(requestId);
        }
    }

    async _handleEvent(message) {
        const eventName = message.event;
        const data = message.data;
        this.emit(eventName, data);
    }

    async _handlePing(message) {
        this._send({
            type: MSG_TYPES.PONG,
            timestamp: Date.now()
        });
    }

    async _handleAuthResponse(message) {
        const requestId = message.id;
        const pending = this.pendingRequests.get(requestId);

        if (!pending) {
            return;
        }

        if (pending.timeout) {
            clearTimeout(pending.timeout);
        }

        if (message.success) {
            this.authenticated = true;
            this.authToken = message.token;
            logger.info('Authentication successful');

            if (this.onAuthenticated) {
                await this.onAuthenticated(message);
            }

            pending.resolve(message);
        } else {
            logger.error('Authentication failed');

            if (this.onAuthFailed) {
                await this.onAuthFailed(message);
            }

            const error = new Error(message.error || 'Authentication failed');
            error.code = message.code;
            pending.reject(error);
        }

        this.pendingRequests.delete(requestId);
    }

    _startHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }

        this.heartbeatTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this._send({
                    type: MSG_TYPES.PING,
                    timestamp: Date.now()
                });

                this.heartbeatTimeoutTimer = setTimeout(() => {
                    logger.warn('Heartbeat timeout - server not responding');
                    if (this.ws) {
                        this.ws.close();
                    }
                }, this.heartbeatTimeout);
            }
        }, this.heartbeatInterval);
    }

    _stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }

        if (this.heartbeatTimeoutTimer) {
            clearTimeout(this.heartbeatTimeoutTimer);
            this.heartbeatTimeoutTimer = null;
        }
    }

    async _send(message) {
        if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.messageQueue.push(message);
            logger.debug('Message queued (not connected)');
            return;
        }

        this.ws.send(JSON.stringify(message));
    }

    async _flushMessageQueue() {
        if (this.messageQueue.length === 0) {
            return;
        }

        logger.debug(`Flushing ${this.messageQueue.length} queued messages`);

        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.ws.send(JSON.stringify(message));
        }
    }

    async _attemptReconnect() {
        this.reconnectAttempts++;
        logger.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

        if (this.onReconnecting) {
            await this.onReconnecting(this.reconnectAttempts);
        }

        setTimeout(async () => {
            try {
                await this.connect();
            } catch (error) {
                logger.error(`Reconnection attempt ${this.reconnectAttempts} failed: ${error.message}`);
            }
        }, this.reconnectInterval);
    }
}

module.exports = WsRpcClient;
