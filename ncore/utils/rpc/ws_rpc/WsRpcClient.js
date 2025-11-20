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

(function (global, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define(factory);
    } else {
        global.WsRpcClient = factory();
    }
}(typeof window !== 'undefined' ? window : this, function () {

    'use strict';

    let WS_RPC_CONSTANTS;
    let MSG_TYPES;
    let DEFAULTS;
    let ERROR_CODES;
    let EVENTS;

    if (typeof module !== 'undefined' && module.exports) {
        const globalVars = require('#@global_vars');
        WS_RPC_CONSTANTS = globalVars.WS_RPC_CONSTANTS;
    } else {
        WS_RPC_CONSTANTS = {
            MESSAGE_TYPES: {
                REQUEST: 'request',
                RESPONSE: 'response',
                EVENT: 'event',
                WELCOME: 'welcome',
                ERROR: 'error',
                PING: 'ping',
                PONG: 'pong',
                AUTH: 'auth',
                AUTH_RESPONSE: 'auth_response',
                SUBSCRIBE: 'subscribe',
                UNSUBSCRIBE: 'unsubscribe',
                BROADCAST: 'broadcast',
                CANCEL: 'cancel'
            },
            DEFAULTS: {
                REQUEST_TIMEOUT: 30000,
                RECONNECT_INTERVAL: 3000,
                MAX_RECONNECT_ATTEMPTS: 10,
                HEARTBEAT_INTERVAL: 30000,
                HEARTBEAT_TIMEOUT: 5000
            },
            ERROR_CODES: {
                ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
                TIMEOUT: 'TIMEOUT',
                UNAUTHORIZED: 'UNAUTHORIZED',
                FORBIDDEN: 'FORBIDDEN',
                PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
                INTERNAL_ERROR: 'INTERNAL_ERROR',
                INVALID_MESSAGE: 'INVALID_MESSAGE',
                CONNECTION_LOST: 'CONNECTION_LOST',
                CANCELLED: 'CANCELLED'
            },
            EVENTS: {
                CONNECTION: 'connection',
                DISCONNECT: 'disconnect',
                ERROR: 'error',
                RECONNECT: 'reconnect',
                RECONNECT_FAILED: 'reconnect_failed',
                AUTHENTICATED: 'authenticated',
                UNAUTHORIZED: 'unauthorized',
                MESSAGE: 'message'
            }
        };
    }

    MSG_TYPES = WS_RPC_CONSTANTS.MESSAGE_TYPES;
    DEFAULTS = WS_RPC_CONSTANTS.DEFAULTS;
    ERROR_CODES = WS_RPC_CONSTANTS.ERROR_CODES;
    EVENTS = WS_RPC_CONSTANTS.EVENTS;

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    class WsRpcClient {
        constructor(url, options = {}) {
            this.url = url;
            this.debug = options.debug || false;
            this.ws = null;
            this.connected = false;
            this.authenticated = false;
            this.clientId = null;
            this.authToken = null;
            this.routes = new Map();
            this.events = new Map();
            this.pendingRequests = new Map();
            this.requestTimeout = options.requestTimeout || DEFAULTS.REQUEST_TIMEOUT;
            this.reconnect = options.reconnect !== false;
            this.reconnectInterval = options.reconnectInterval || DEFAULTS.RECONNECT_INTERVAL;
            this.reconnectAttempts = 0;
            this.maxReconnectAttempts = options.maxReconnectAttempts || DEFAULTS.MAX_RECONNECT_ATTEMPTS;
            this.messageQueue = [];

            this.heartbeatInterval = options.heartbeatInterval || DEFAULTS.HEARTBEAT_INTERVAL;
            this.heartbeatTimeout = options.heartbeatTimeout || DEFAULTS.HEARTBEAT_TIMEOUT;
            this.heartbeatTimer = null;
            this.heartbeatTimeoutTimer = null;
            this.enableHeartbeat = options.enableHeartbeat !== false;

            this.requestInterceptors = [];
            this.responseInterceptors = [];
            this.errorInterceptors = [];

            this.compressionEnabled = options.compression?.enabled || false;
            this.compressionThreshold = options.compression?.threshold || 1024;

            this.eventHandlers = {
                onConnected: null,
                onDisconnected: null,
                onError: null,
                onReconnecting: null,
                onAuthenticated: null,
                onAuthFailed: null,
                onHeartbeatTimeout: null
            };

            if (options.events) {
                Object.assign(this.eventHandlers, options.events);
            }
        }

        connect() {
            return new Promise((resolve, reject) => {
                try {
                    this._log(`Connecting to ${this.url}...`);

                    this.ws = new WebSocket(this.url);

                    this.ws.onopen = () => {
                        this.connected = true;
                        this.reconnectAttempts = 0;
                        this._log('Connected to server');
                        this._flushMessageQueue();

                        if (this.enableHeartbeat) {
                            this._startHeartbeat();
                        }

                        if (this.eventHandlers.onConnected) {
                            this.eventHandlers.onConnected();
                        }

                        this._emitEvent(EVENTS.CONNECTION);
                        resolve();
                    };

                    this.ws.onmessage = (event) => {
                        this._handleMessage(event.data);
                    };

                    this.ws.onclose = () => {
                        this.connected = false;
                        this.authenticated = false;
                        this._stopHeartbeat();
                        this._log('Disconnected from server');

                        if (this.eventHandlers.onDisconnected) {
                            this.eventHandlers.onDisconnected();
                        }

                        this._emitEvent(EVENTS.DISCONNECT);

                        if (this.reconnect) {
                            this._attemptReconnect();
                        }
                    };

                    this.ws.onerror = (error) => {
                        this._log('WebSocket error:', error);

                        if (this.eventHandlers.onError) {
                            this.eventHandlers.onError(error);
                        }

                        this._emitEvent(EVENTS.ERROR, error);

                        if (!this.connected) {
                            reject(error);
                        }
                    };

                } catch (error) {
                    reject(error);
                }
            });
        }

        disconnect() {
            this.reconnect = false;
            this._stopHeartbeat();

            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }

            this.connected = false;
            this.authenticated = false;

            this.pendingRequests.forEach((pending, requestId) => {
                clearTimeout(pending.timeout);
                pending.reject(new Error('Client disconnected'));
            });
            this.pendingRequests.clear();
        }

        async authenticate(credentials) {
            if (!this.connected) {
                throw new Error('Not connected to server');
            }

            return new Promise((resolve, reject) => {
                const requestId = generateUUID();

                this._send({
                    type: MSG_TYPES.AUTH,
                    id: requestId,
                    credentials: credentials,
                    timestamp: Date.now()
                });

                const timeout = setTimeout(() => {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Authentication timeout'));
                }, this.requestTimeout);

                this.pendingRequests.set(requestId, {
                    resolve: (result) => {
                        if (result.success) {
                            this.authenticated = true;
                            this.authToken = result.token;
                            this._log('Authentication successful');

                            if (this.eventHandlers.onAuthenticated) {
                                this.eventHandlers.onAuthenticated(result);
                            }

                            this._emitEvent(EVENTS.AUTHENTICATED, result);
                            resolve(result);
                        } else {
                            this._log('Authentication failed:', result.message);

                            if (this.eventHandlers.onAuthFailed) {
                                this.eventHandlers.onAuthFailed(result);
                            }

                            this._emitEvent(EVENTS.UNAUTHORIZED, result);
                            reject(new Error(result.message || 'Authentication failed'));
                        }
                    },
                    reject,
                    timeout,
                    route: 'authenticate'
                });
            });
        }

        subscribe(namespace, room = null) {
            this._send({
                type: MSG_TYPES.SUBSCRIBE,
                namespace: namespace,
                room: room,
                timestamp: Date.now()
            });
            this._log(`Subscribed to namespace: ${namespace}${room ? `, room: ${room}` : ''}`);
        }

        unsubscribe(namespace, room = null) {
            this._send({
                type: MSG_TYPES.UNSUBSCRIBE,
                namespace: namespace,
                room: room,
                timestamp: Date.now()
            });
            this._log(`Unsubscribed from namespace: ${namespace}${room ? `, room: ${room}` : ''}`);
        }

        cancelRequest(requestId) {
            const pending = this.pendingRequests.get(requestId);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(requestId);

                this._send({
                    type: MSG_TYPES.CANCEL,
                    requestId: requestId,
                    timestamp: Date.now()
                });

                pending.reject(new Error(ERROR_CODES.CANCELLED));
                this._log(`Request cancelled: ${requestId}`);
            }
        }

        addRequestInterceptor(onFulfilled, onRejected = null) {
            const id = this.requestInterceptors.length;
            this.requestInterceptors.push({ id, onFulfilled, onRejected });
            return id;
        }

        addResponseInterceptor(onFulfilled, onRejected = null) {
            const id = this.responseInterceptors.length;
            this.responseInterceptors.push({ id, onFulfilled, onRejected });
            return id;
        }

        addErrorInterceptor(handler) {
            const id = this.errorInterceptors.length;
            this.errorInterceptors.push({ id, handler });
            return id;
        }

        removeRequestInterceptor(id) {
            this.requestInterceptors = this.requestInterceptors.filter(i => i.id !== id);
        }

        removeResponseInterceptor(id) {
            this.responseInterceptors = this.responseInterceptors.filter(i => i.id !== id);
        }

        removeErrorInterceptor(id) {
            this.errorInterceptors = this.errorInterceptors.filter(i => i.id !== id);
        }

        route(routeName, handler) {
            if (typeof handler !== 'function') {
                this._log(`Handler for route "${routeName}" must be a function`);
                return this;
            }

            this.routes.set(routeName, handler);
            this._log(`Route registered: ${routeName}`);
            return this;
        }

        on(eventName, handler) {
            if (typeof handler !== 'function') {
                this._log(`Handler for event "${eventName}" must be a function`);
                return this;
            }

            if (!this.events.has(eventName)) {
                this.events.set(eventName, []);
            }
            this.events.get(eventName).push(handler);
            this._log(`Event listener registered: ${eventName}`);
            return this;
        }

        async call(routeName, params = {}) {
            return new Promise(async (resolve, reject) => {
                if (!this.connected) {
                    return reject(new Error('Not connected to server'));
                }

                const requestId = generateUUID();
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

                try {
                    message = await this._executeRequestInterceptors(message);
                } catch (error) {
                    return reject(error);
                }

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
                this._log(`Calling server route: ${routeName} (ID: ${requestId})`);
            });
        }

        emit(eventName, data) {
            const message = {
                type: MSG_TYPES.EVENT,
                event: eventName,
                data: data,
                timestamp: Date.now()
            };

            this._send(message);
            this._log(`Event emitted: ${eventName}`);
        }

        _startHeartbeat() {
            this._stopHeartbeat();

            this.heartbeatTimer = setInterval(() => {
                this._sendHeartbeat();
            }, this.heartbeatInterval);

            this._log('Heartbeat started');
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

        _sendHeartbeat() {
            this._send({
                type: MSG_TYPES.PONG,
                timestamp: Date.now()
            });

            if (this.heartbeatTimeoutTimer) {
                clearTimeout(this.heartbeatTimeoutTimer);
            }

            this.heartbeatTimeoutTimer = setTimeout(() => {
                this._log('Heartbeat timeout - server not responding');

                if (this.eventHandlers.onHeartbeatTimeout) {
                    this.eventHandlers.onHeartbeatTimeout();
                }

                if (this.ws) {
                    this.ws.close();
                }
            }, this.heartbeatTimeout);
        }

        _send(message) {
            if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
                this.messageQueue.push(message);
                this._log('Message queued (not connected)');
                return;
            }

            this.ws.send(JSON.stringify(message));
        }

        _flushMessageQueue() {
            if (this.messageQueue.length === 0) {
                return;
            }

            this._log(`Flushing ${this.messageQueue.length} queued messages`);

            while (this.messageQueue.length > 0) {
                const message = this.messageQueue.shift();
                this.ws.send(JSON.stringify(message));
            }
        }

        async _handleMessage(data) {
            try {
                let message = JSON.parse(data);
                this._log(`Received message: ${message.type}`);

                if (this.heartbeatTimeoutTimer) {
                    clearTimeout(this.heartbeatTimeoutTimer);
                    this.heartbeatTimeoutTimer = null;
                }

                switch (message.type) {
                    case MSG_TYPES.WELCOME:
                        this.clientId = message.clientId;
                        this._log(`Assigned client ID: ${this.clientId}`);
                        if (message.authRequired) {
                            this._log('Server requires authentication');
                        }
                        break;

                    case MSG_TYPES.REQUEST:
                        await this._handleRequest(message);
                        break;

                    case MSG_TYPES.RESPONSE:
                        await this._handleResponse(message);
                        break;

                    case MSG_TYPES.EVENT:
                        this._handleEvent(message);
                        break;

                    case MSG_TYPES.ERROR:
                        this._log('Server error:', message.error);
                        this._emitEvent(EVENTS.ERROR, message);
                        break;

                    case MSG_TYPES.PING:
                        this._handlePing(message);
                        break;

                    case MSG_TYPES.AUTH_RESPONSE:
                        this._handleAuthResponse(message);
                        break;

                    default:
                        this._log(`Unknown message type: ${message.type}`);
                }
            } catch (error) {
                this._log('Error handling message:', error);
                await this._executeErrorInterceptors(error);
            }
        }

        _handlePing(message) {
            this._send({
                type: MSG_TYPES.PONG,
                timestamp: message.timestamp || Date.now()
            });
        }

        _handleAuthResponse(message) {
            const { id: requestId } = message;
            const pending = this.pendingRequests.get(requestId);

            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(requestId);
                pending.resolve(message);
            }
        }

        async _handleRequest(message) {
            const { id: requestId, route, params } = message;

            try {
                const handler = this.routes.get(route);

                if (!handler) {
                    this._log(`Route not found: ${route}`);
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

                const startTime = Date.now();
                const result = await Promise.resolve(handler(params));
                const duration = Date.now() - startTime;

                this._log(`Route executed: ${route} (${duration}ms)`);

                this._send({
                    type: MSG_TYPES.RESPONSE,
                    id: requestId,
                    success: true,
                    result: result,
                    timestamp: Date.now()
                });

            } catch (error) {
                this._log(`Route error (${route}):`, error);

                await this._executeErrorInterceptors(error, { route });

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
            const { id: requestId, success, result, error } = message;
            const pending = this.pendingRequests.get(requestId);

            if (!pending) {
                this._log(`No pending request found for ID: ${requestId}`);
                return;
            }

            clearTimeout(pending.timeout);
            this.pendingRequests.delete(requestId);

            try {
                if (success) {
                    let processedResult = result;

                    if (result && result.compressed) {
                        processedResult = result.data;
                    }

                    processedResult = await this._executeResponseInterceptors(processedResult);

                    this._log(`Request success: ${pending.route}`);
                    pending.resolve(processedResult);
                } else {
                    this._log(`Request error: ${pending.route} - ${error}`);
                    const err = new Error(error || 'Unknown error');
                    err.code = message.code;
                    pending.reject(err);
                }
            } catch (interceptorError) {
                this._log(`Interceptor error:`, interceptorError);
                pending.reject(interceptorError);
            }
        }

        _handleEvent(message) {
            const { event: eventName, data } = message;
            this._emitEvent(eventName, data);
        }

        _emitEvent(eventName, data) {
            const handlers = this.events.get(eventName);

            if (!handlers || handlers.length === 0) {
                return;
            }

            handlers.forEach(async (handler) => {
                try {
                    await Promise.resolve(handler(data));
                } catch (error) {
                    this._log(`Event handler error (${eventName}):`, error);
                }
            });
        }

        async _executeRequestInterceptors(request) {
            let result = request;

            for (const interceptor of this.requestInterceptors) {
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

            return result;
        }

        async _executeResponseInterceptors(response) {
            let result = response;

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

            return result;
        }

        async _executeErrorInterceptors(error, context = {}) {
            let result = error;

            for (const interceptor of this.errorInterceptors) {
                try {
                    const handlerResult = await interceptor.handler(result, context);
                    if (handlerResult !== undefined) {
                        result = handlerResult;
                    }
                } catch (handlerError) {
                    this._log('Error interceptor failed:', handlerError);
                }
            }

            return result;
        }

        _attemptReconnect() {
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                this._log('Max reconnection attempts reached');
                this._emitEvent(EVENTS.RECONNECT_FAILED);
                return;
            }

            this.reconnectAttempts++;
            this._log(`Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

            if (this.eventHandlers.onReconnecting) {
                this.eventHandlers.onReconnecting(this.reconnectAttempts);
            }

            this._emitEvent(EVENTS.RECONNECT, { attempt: this.reconnectAttempts });

            setTimeout(() => {
                this.connect().catch((error) => {
                    this._log('Reconnection failed:', error);
                });
            }, this.reconnectInterval);
        }

        _log(...args) {
            if (this.debug) {
                console.log('[WsRpcClient]', ...args);
            }
        }

        isConnected() {
            return this.connected;
        }

        isAuthenticated() {
            return this.authenticated;
        }

        getClientId() {
            return this.clientId;
        }

        getAuthToken() {
            return this.authToken;
        }

        getPendingRequestCount() {
            return this.pendingRequests.size;
        }

        getQueuedMessageCount() {
            return this.messageQueue.length;
        }
    }

    return WsRpcClient;
}));
