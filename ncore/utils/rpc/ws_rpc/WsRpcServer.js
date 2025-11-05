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

const WebSocket = require('ws');
const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const logger = require('#@logger');
const { RPC_CONSTANTS, getSessionManager, getRequestManager, getResponseCache } = require('../common');
const WS_RPC_CONSTANTS = RPC_CONSTANTS;
const HeartbeatManager = require('./libs/HeartbeatManager');
const MiddlewareChain = require('./libs/MiddlewareChain');
const AuthManager = require('./libs/AuthManager');
const RateLimiter = require('./libs/RateLimiter');
const PerformanceMonitor = require('./libs/PerformanceMonitor');
const NamespaceManager = require('./libs/NamespaceManager');
const MessageCompressor = require('./libs/MessageCompressor');
const InterceptorManager = require('./libs/InterceptorManager');

const MSG_TYPES = WS_RPC_CONSTANTS.MESSAGE_TYPES;
const DEFAULTS = WS_RPC_CONSTANTS.DEFAULTS;
const ERROR_CODES = WS_RPC_CONSTANTS.ERROR_CODES;
const EVENTS = WS_RPC_CONSTANTS.EVENTS;

class WsRpcServer extends EventEmitter {
    constructor(wssOrOptions = {}) {
        super();

        let options;

        if (wssOrOptions instanceof WebSocket.Server) {
            this.wss = wssOrOptions;
            this.externalWss = true;
            options = {};
            this.port = null;
            this.host = null;
        } else {
            options = wssOrOptions;
            this.wss = null;
            this.externalWss = false;
            this.port = options.port || DEFAULTS.SERVER_PORT;
            this.host = options.host || DEFAULTS.SERVER_HOST;
        }

        this.debug = options.debug || false;
        this.requestTimeout = options.requestTimeout || DEFAULTS.REQUEST_TIMEOUT;
        this.maxPayloadSize = options.maxPayloadSize || DEFAULTS.MAX_PAYLOAD_SIZE;

        this.routes = new Map();
        this.events = new Map();
        this.pendingRequests = new Map();
        this.clients = new Map();

        this.sessionManager = getSessionManager();
        this.requestManager = getRequestManager();
        this.responseCache = getResponseCache();
        this.subAppManager = require('../common').getSubAppManager();

        this.heartbeat = new HeartbeatManager({
            interval: options.heartbeatInterval || DEFAULTS.HEARTBEAT_INTERVAL,
            timeout: options.heartbeatTimeout || DEFAULTS.HEARTBEAT_TIMEOUT,
            onTimeout: (clientId) => this._handleHeartbeatTimeout(clientId),
            onPong: (clientId, latency) => this.emit('latency', clientId, latency)
        });

        this.middleware = new MiddlewareChain();

        this.auth = new AuthManager({
            enabled: options.auth?.enabled,
            secret: options.auth?.secret,
            tokenExpiry: options.auth?.tokenExpiry,
            authHandler: options.auth?.handler
        });

        this.rateLimiter = new RateLimiter({
            enabled: options.rateLimit?.enabled,
            maxRequests: options.rateLimit?.maxRequests,
            windowMs: options.rateLimit?.windowMs,
            onLimitReached: (clientId) => this.emit('rateLimitReached', clientId)
        });

        this.performance = new PerformanceMonitor({
            enabled: options.performance?.enabled !== false,
            sampleRate: options.performance?.sampleRate,
            maxHistorySize: options.performance?.maxHistorySize
        });

        this.namespace = new NamespaceManager();

        this.compressor = new MessageCompressor({
            enabled: options.compression?.enabled,
            threshold: options.compression?.threshold,
            algorithm: options.compression?.algorithm
        });

        this.interceptors = new InterceptorManager();

        this.options = options;
    }

    start() {
        return new Promise((resolve, reject) => {
            try {
                if (this.externalWss) {
                    this._attachHandlers();
                    logger.success('WebSocket RPC Server attached to existing WebSocket server');
                    resolve();
                    return;
                }

                this.wss = new WebSocket.Server({
                    host: this.host,
                    port: this.port
                });

                this._attachHandlers();

                this.wss.on('listening', () => {
                    logger.success(`WebSocket RPC Server listening on ${this.host}:${this.port}`);
                    resolve();
                });

            } catch (error) {
                logger.error('Failed to start WsRpcServer:', error);
                reject(error);
            }
        });
    }

    _attachHandlers() {
        if (!this.wss) {
            logger.error('Cannot attach handlers: WebSocket server is null');
            return;
        }

        this.wss.on('connection', (ws, req) => {
            this._handleConnection(ws, req);
        });

        this.wss.on('error', (error) => {
            logger.error('WsRpcServer error:', error);
            this.emit('error', error);
        });
    }

    stop() {
        return new Promise((resolve) => {
            this.heartbeat.stopAll();

            this.clients.forEach((ws, clientId) => {
                ws.close();
            });
            this.clients.clear();

            this.pendingRequests.forEach((pending, requestId) => {
                clearTimeout(pending.timeout);
                pending.reject(new Error('Server shutting down'));
            });
            this.pendingRequests.clear();

            this.rateLimiter.destroy();
            this.namespace.clear();

            if (this.wss && !this.externalWss) {
                this.wss.close(() => {
                    logger.info('WebSocket RPC Server stopped');
                    resolve();
                });
            } else {
                if (this.externalWss) {
                    logger.info('WebSocket RPC Server detached from external server');
                }
                resolve();
            }
        });
    }

    use(middleware) {
        this.middleware.use(middleware);
        return this;
    }

    useError(errorHandler) {
        this.middleware.useError(errorHandler);
        return this;
    }

    addRequestInterceptor(onFulfilled, onRejected) {
        return this.interceptors.addRequestInterceptor(onFulfilled, onRejected);
    }

    addResponseInterceptor(onFulfilled, onRejected) {
        return this.interceptors.addResponseInterceptor(onFulfilled, onRejected);
    }

    addErrorInterceptor(handler) {
        return this.interceptors.addErrorInterceptor(handler);
    }

    createNamespace(name) {
        this.namespace.createNamespace(name);
        return this;
    }

    broadcastToNamespace(namespace, message) {
        const clients = this.namespace.getNamespaceClients(namespace);
        const messageStr = JSON.stringify(message);
        clients.forEach(clientId => {
            const clientInfo = this.clients.get(clientId);
            if (clientInfo && clientInfo.ws && clientInfo.ws.readyState === WebSocket.OPEN) {
                clientInfo.ws.send(messageStr);
            }
        });
    }

    broadcastToRoom(room, message, namespace = 'default') {
        const clients = this.namespace.getRoomClients(room, namespace);
        const messageStr = JSON.stringify(message);
        clients.forEach(clientId => {
            const clientInfo = this.clients.get(clientId);
            if (clientInfo && clientInfo.ws && clientInfo.ws.readyState === WebSocket.OPEN) {
                clientInfo.ws.send(messageStr);
            }
        });
    }

    getPerformanceStats() {
        return this.performance.getGlobalStats();
    }

    getRouteStats(routeName) {
        return this.performance.getRouteStats(routeName);
    }

    getClientStats(clientId) {
        return this.performance.getClientStats(clientId);
    }

    getRateLimitStats(clientId) {
        return this.rateLimiter.getStats(clientId);
    }

    getCompressionStats() {
        return this.compressor.getStats();
    }

    getHeartbeatStats(clientId) {
        return this.heartbeat.getStats(clientId);
    }

    getAllStats() {
        return {
            performance: this.getPerformanceStats(),
            compression: this.getCompressionStats(),
            namespace: this.namespace.getStats(),
            middlewareCount: this.middleware.count(),
            interceptorCount: this.interceptors.getCount(),
            routeCount: this.routes.size,
            eventCount: this.events.size,
            clientCount: this.clients.size
        };
    }

    route(routeName, handler) {
        if (typeof handler !== 'function') {
            logger.error(`Handler for route "${routeName}" must be a function`);
            return this;
        }

        this.routes.set(routeName, handler);
        logger.debug(`Route registered: ${routeName}`);
        return this;
    }

    on(eventName, handler) {
        if (!this.events.has(eventName)) {
            this.events.set(eventName, []);
        }
        this.events.get(eventName).push(handler);
        logger.debug(`Event listener registered: ${eventName}`);
        return this;
    }

    triggerEvent(eventName, data, targetClientId = null) {
        const message = {
            type: MSG_TYPES.EVENT,
            event: eventName,
            data: data,
            timestamp: Date.now()
        };

        if (targetClientId) {
            const clientInfo = this.clients.get(targetClientId);
            if (clientInfo && clientInfo.ws && clientInfo.ws.readyState === WebSocket.OPEN) {
                clientInfo.ws.send(JSON.stringify(message));
            }
        } else {
            this.broadcast(message);
        }
    }

    callClient(routeName, params, clientId) {
        return new Promise((resolve, reject) => {
            const clientInfo = this.clients.get(clientId);

            if (!clientInfo || !clientInfo.ws || clientInfo.ws.readyState !== WebSocket.OPEN) {
                logger.error(`Client ${clientId} not connected`);
                return reject(new Error(`Client ${clientId} not connected`));
            }

            const requestId = uuidv4();
            const message = {
                type: MSG_TYPES.REQUEST,
                id: requestId,
                route: routeName,
                params: params,
                timestamp: Date.now()
            };

            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                logger.warn(`Request timeout: ${routeName}`);
                reject(new Error(`Request timeout: ${routeName}`));
            }, this.requestTimeout);

            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                timeout,
                route: routeName,
                clientId
            });

            clientInfo.ws.send(JSON.stringify(message));
            logger.debug(`Calling client route: ${routeName} (ID: ${requestId})`);
        });
    }

    broadcast(message) {
        const messageStr = JSON.stringify(message);
        this.clients.forEach((clientInfo, clientId) => {
            if (clientInfo.ws && clientInfo.ws.readyState === WebSocket.OPEN) {
                clientInfo.ws.send(messageStr);
            }
        });
    }

    getClients() {
        return Array.from(this.clients.keys());
    }

    _handleConnection(ws, req) {
        const tempId = uuidv4();
        let clientId = null;

        this.clients.set(tempId, { ws, clientId: null });

        logger.info(`Client connected (temp): ${tempId} from ${req.socket.remoteAddress}`);
        this.emit(EVENTS.CONNECTION, tempId);

        ws.send(JSON.stringify({
            type: MSG_TYPES.WELCOME,
            tempId: tempId,
            authRequired: this.auth.enabled,
            timestamp: Date.now()
        }));

        ws.on('message', async (data) => {
            try {
                const message = JSON.parse(data.toString());

                if (message.type === 'init' && message.clientId) {
                    clientId = message.clientId;
                    const sessionId = this.sessionManager.createSession(clientId);
                    this.sessionManager.addToGroup(clientId, sessionId);

                    this.clients.delete(tempId);
                    this.clients.set(clientId, { ws, clientId, sessionId });

                    this.heartbeat.start(clientId, (msg) => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify(msg));
                        }
                    });

                    logger.info(`Client initialized: ${clientId} (session: ${sessionId})`);
                    return;
                }

                const actualClientId = clientId || tempId;
                await this._handleMessage(actualClientId, data);

            } catch (error) {
                logger.error('Error processing message:', error);
            }
        });

        ws.on('close', () => {
            const actualClientId = clientId || tempId;
            this.heartbeat.stop(actualClientId);
            this.auth.revoke(actualClientId);
            this.namespace.removeClient(actualClientId);
            this.clients.delete(actualClientId);

            if (clientId) {
                const clientInfo = this.clients.get(clientId);
                if (clientInfo && clientInfo.sessionId) {
                    this.sessionManager.removeSession(clientInfo.sessionId);
                }
            }

            logger.info(`Client disconnected: ${actualClientId}`);
            this.emit(EVENTS.DISCONNECT, actualClientId);
        });

        ws.on('error', (error) => {
            const actualClientId = clientId || tempId;
            logger.error(`Client error (${actualClientId}):`, error);
            this.emit(EVENTS.ERROR, error, actualClientId);
        });
    }

    _handleHeartbeatTimeout(clientId) {
        const clientInfo = this.clients.get(clientId);
        if (clientInfo && clientInfo.ws) {
            logger.warn(`Heartbeat timeout for client ${clientId}, closing connection`);
            clientInfo.ws.close();
        }
    }

    async _handleMessage(clientId, data) {
        try {
            if (data.length > this.maxPayloadSize) {
                logger.error(`Payload too large from ${clientId}: ${data.length} bytes`);
                this._sendError(clientId, ERROR_CODES.PAYLOAD_TOO_LARGE, 'Payload exceeds maximum size');
                return;
            }

            let message = JSON.parse(data.toString());
            logger.debug(`Received message from ${clientId}: ${message.type}`);

            if (message.compressed) {
                message = await this.compressor.decompress(message);
            }

            message = await this.interceptors.executeRequestInterceptors(message);

            switch (message.type) {
                case MSG_TYPES.REQUEST:
                    await this._handleRequest(clientId, message);
                    break;

                case MSG_TYPES.RESPONSE:
                    this._handleResponse(message);
                    break;

                case MSG_TYPES.EVENT:
                    this._handleEvent(clientId, message);
                    break;

                case MSG_TYPES.PONG:
                    this.heartbeat.receivedPong(clientId, message);
                    break;

                case MSG_TYPES.AUTH:
                    await this._handleAuth(clientId, message);
                    break;

                case MSG_TYPES.SUBSCRIBE:
                    this._handleSubscribe(clientId, message);
                    break;

                case MSG_TYPES.UNSUBSCRIBE:
                    this._handleUnsubscribe(clientId, message);
                    break;

                case MSG_TYPES.CANCEL:
                    this._handleCancel(clientId, message);
                    break;

                default:
                    logger.warn(`Unknown message type: ${message.type}`);
            }
        } catch (error) {
            logger.error('Error handling message:', error);
            const handledError = await this.interceptors.executeErrorInterceptors(error, { clientId });
            this._sendError(clientId, ERROR_CODES.INTERNAL_ERROR, handledError.message || error.message);
        }
    }

    _sendError(clientId, code, message) {
        const clientInfo = this.clients.get(clientId);
        if (clientInfo && clientInfo.ws && clientInfo.ws.readyState === WebSocket.OPEN) {
            clientInfo.ws.send(JSON.stringify({
                type: MSG_TYPES.ERROR,
                code: code,
                error: message,
                timestamp: Date.now()
            }));
        }
    }

    async _handleAuth(clientId, message) {
        const { credentials } = message;
        const result = await this.auth.authenticate(clientId, credentials);

        const clientInfo = this.clients.get(clientId);
        if (clientInfo && clientInfo.ws && clientInfo.ws.readyState === WebSocket.OPEN) {
            clientInfo.ws.send(JSON.stringify({
                type: MSG_TYPES.AUTH_RESPONSE,
                success: result.success,
                token: result.token,
                expiresIn: result.expiresIn,
                error: result.error,
                message: result.message,
                timestamp: Date.now()
            }));

            if (result.success) {
                this.emit(EVENTS.AUTHENTICATED, clientId);
            } else {
                this.emit(EVENTS.UNAUTHORIZED, clientId);
            }
        }
    }

    _handleSubscribe(clientId, message) {
        const { namespace, room } = message;

        if (namespace) {
            this.namespace.joinNamespace(clientId, namespace);
            logger.debug(`Client ${clientId} subscribed to namespace: ${namespace}`);
        }

        if (room) {
            this.namespace.joinRoom(clientId, room, namespace || 'default');
            logger.debug(`Client ${clientId} joined room: ${room}`);
        }
    }

    _handleUnsubscribe(clientId, message) {
        const { namespace, room } = message;

        if (namespace) {
            this.namespace.leaveNamespace(clientId, namespace);
            logger.debug(`Client ${clientId} unsubscribed from namespace: ${namespace}`);
        }

        if (room) {
            this.namespace.leaveRoom(clientId, room, namespace || 'default');
            logger.debug(`Client ${clientId} left room: ${room}`);
        }
    }

    _handleCancel(clientId, message) {
        const { requestId } = message;
        const pending = this.pendingRequests.get(requestId);

        if (pending && pending.clientId === clientId) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(requestId);
            pending.reject(new Error(ERROR_CODES.CANCELLED));
            logger.debug(`Request cancelled: ${requestId}`);
        }
    }

    async _handleRequest(clientId, message) {
        const { id: requestId, route, params } = message;
        const clientInfo = this.clients.get(clientId);

        if (!clientInfo || !clientInfo.ws) {
            return;
        }

        const sessionId = clientInfo.sessionId;
        if (sessionId) {
            this.sessionManager.updateActivity(sessionId);
        }

        this.performance.startRequest(requestId, route, clientId);

        try {
            const rateLimitCheck = this.rateLimiter.check(clientId);
            if (!rateLimitCheck.allowed) {
                logger.warn(`Rate limit exceeded for client ${clientId}`);
                await this._sendResponseWithRetry(clientId, requestId, false, null, ERROR_CODES.FORBIDDEN, 'Rate limit exceeded');
                this.performance.endRequest(requestId, false, new Error('Rate limit exceeded'));
                return;
            }

            if (this.auth.enabled && !this.auth.isAuthenticated(clientId)) {
                logger.warn(`Unauthorized request from client ${clientId}`);
                await this._sendResponseWithRetry(clientId, requestId, false, null, ERROR_CODES.UNAUTHORIZED, 'Authentication required');
                this.performance.endRequest(requestId, false, new Error('Unauthorized'));
                return;
            }

            let handler = this.routes.get(route);
            let isSubAppRoute = false;

            if (!handler) {
                if (this.subAppManager.routes.has(route)) {
                    handler = async (params, clientId, ctx) => {
                        return await this.subAppManager.executeRoute(
                            route,
                            params,
                            requestId,
                            { ...ctx, clientId }
                        );
                    };
                    isSubAppRoute = true;
                } else {
                    logger.error(`Route not found: ${route}`);
                    await this._sendResponseWithRetry(clientId, requestId, false, null, ERROR_CODES.ROUTE_NOT_FOUND, `Route not found: ${route}`);
                    this.performance.endRequest(requestId, false, new Error('Route not found'));
                    return;
                }
            }

            const context = {
                clientId,
                requestId,
                route,
                params,
                auth: this.auth.getAuthData(clientId),
                sessionId,
                ws: clientInfo.ws
            };

            const result = await this.middleware.execute(context, async (ctx) => {
                return await Promise.resolve(handler(ctx.params, ctx.clientId, ctx));
            });

            let processedResult = await this.interceptors.executeResponseInterceptors(result);

            const compressed = await this.compressor.compress(processedResult);
            if (compressed.compressed) {
                processedResult = compressed;
            }

            await this._sendResponseWithRetry(clientId, requestId, true, processedResult);
            this.performance.endRequest(requestId, true);

            logger.debug(`Route executed successfully: ${route}`);

        } catch (error) {
            logger.error(`Route error (${route}):`, error);

            const handledError = await this.interceptors.executeErrorInterceptors(error, { clientId, route });

            await this._sendResponseWithRetry(clientId, requestId, false, null, ERROR_CODES.INTERNAL_ERROR, handledError.message || error.message);
            this.performance.endRequest(requestId, false, error);
        }
    }

    async _sendResponseWithRetry(clientId, requestId, success, result = null, code = null, error = null) {
        const responseData = {
            type: MSG_TYPES.RESPONSE,
            id: requestId,
            success,
            result,
            code,
            error,
            timestamp: Date.now()
        };

        const clientInfo = this.clients.get(clientId);
        if (!clientInfo || !clientInfo.ws) {
            this.responseCache.set(requestId, responseData, 1800000);
            logger.warn(`Client ${clientId} not found, response cached for HTTP query`);
            return false;
        }

        const ws = clientInfo.ws;
        const maxRetries = 3;
        const retryInterval = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(responseData));
                    logger.debug(`WebSocket response sent to ${clientId} (attempt ${attempt}/${maxRetries})`);
                    return true;
                } else {
                    logger.warn(`WebSocket not open for ${clientId}, readyState: ${ws.readyState} (attempt ${attempt}/${maxRetries})`);
                }
            } catch (sendError) {
                logger.error(`Failed to send WebSocket response to ${clientId} (attempt ${attempt}/${maxRetries}):`, sendError);
            }

            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, retryInterval));
            }
        }

        this.responseCache.set(requestId, responseData, 1800000);
        logger.warn(`WebSocket send failed after ${maxRetries} attempts for ${clientId}, response cached for HTTP query`);
        return false;
    }

    _sendResponse(ws, requestId, success, result = null, code = null, error = null) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: MSG_TYPES.RESPONSE,
                id: requestId,
                success,
                result,
                code,
                error,
                timestamp: Date.now()
            }));
        }
    }

    _handleResponse(message) {
        const { id: requestId, success, result, error } = message;
        const pending = this.pendingRequests.get(requestId);

        if (!pending) {
            logger.warn(`No pending request found for ID: ${requestId}`);
            return;
        }

        clearTimeout(pending.timeout);
        this.pendingRequests.delete(requestId);

        if (success) {
            pending.resolve(result);
        } else {
            pending.reject(new Error(error || 'Unknown error'));
        }
    }

    _handleEvent(clientId, message) {
        const { event: eventName, data } = message;
        const handlers = this.events.get(eventName);

        if (!handlers || handlers.length === 0) {
            logger.debug(`No handlers for event: ${eventName}`);
            return;
        }

        handlers.forEach(async (handler) => {
            try {
                await Promise.resolve(handler(data, clientId));
            } catch (error) {
                logger.error(`Event handler error (${eventName}):`, error);
            }
        });
    }
}

module.exports = WsRpcServer;
