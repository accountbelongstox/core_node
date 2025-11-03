class WsRpcBrowserClient {
    constructor(url, options = {}) {
        this.url = url;
        this.debug = options.debug || false;
        this.ws = null;
        this.connected = false;
        this.clientId = null;

        this.routes = new Map();
        this.pendingRequests = new Map();
        this.messageQueue = [];
        this.eventHandlers = new Map();

        this.requestTimeout = options.requestTimeout || 30000;
        this.reconnect = options.reconnect !== undefined ? options.reconnect : true;
        this.reconnectInterval = options.reconnectInterval || 3000;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = options.maxReconnectAttempts || 10;

        this.heartbeatInterval = options.heartbeatInterval || 30000;
        this.enableHeartbeat = options.enableHeartbeat !== undefined ? options.enableHeartbeat : true;
        this.heartbeatTimer = null;

        this.onConnected = options.onConnected;
        this.onDisconnected = options.onDisconnected;
        this.onError = options.onError;
        this.onReconnecting = options.onReconnecting;

        this.MSG_TYPES = {
            REQUEST: 'request',
            RESPONSE: 'response',
            EVENT: 'event',
            ERROR: 'error',
            PING: 'ping',
            PONG: 'pong',
            WELCOME: 'welcome'
        };

        this.ERROR_CODES = {
            ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
            INTERNAL_ERROR: 'INTERNAL_ERROR',
            TIMEOUT: 'TIMEOUT'
        };
    }

    connect() {
        return new Promise((resolve, reject) => {
            try {
                this._log('info', `Connecting to ${this.url}...`);
                this.ws = new WebSocket(this.url);

                this.ws.onopen = async () => {
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    this._log('info', 'Connected to server');

                    await this._flushMessageQueue();

                    if (this.enableHeartbeat) {
                        this._startHeartbeat();
                    }

                    if (this.onConnected) {
                        await this.onConnected();
                    }

                    this._emit('connection', {});
                    resolve();
                };

                this.ws.onmessage = async (event) => {
                    await this._handleMessage(event.data);
                };

                this.ws.onclose = async () => {
                    this._log('warn', 'Connection closed');
                    this.connected = false;
                    this._stopHeartbeat();

                    if (this.onDisconnected) {
                        await this.onDisconnected();
                    }

                    this._emit('disconnect', {});

                    if (this.reconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                        await this._attemptReconnect();
                    }
                };

                this.ws.onerror = async (error) => {
                    this._log('error', `WebSocket error: ${error.message || 'Unknown error'}`);
                    if (this.onError) {
                        await this.onError(error);
                    }
                    reject(error);
                };
            } catch (error) {
                this._log('error', `Connection error: ${error.message}`);
                if (this.onError) {
                    this.onError(error);
                }
                reject(error);
            }
        });
    }

    disconnect() {
        this.reconnect = false;
        this._stopHeartbeat();

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close();
        }

        this.connected = false;

        this.pendingRequests.forEach((pending) => {
            if (pending.timeout) {
                clearTimeout(pending.timeout);
            }
            pending.reject(new Error('Connection closed'));
        });
        this.pendingRequests.clear();
    }

    route(routeName, handler) {
        if (typeof handler !== 'function') {
            this._log('error', `Handler for route '${routeName}' must be a function`);
            return this;
        }

        this.routes.set(routeName, handler);
        this._log('debug', `Route registered: ${routeName}`);
        return this;
    }

    on(eventName, handler) {
        if (!this.eventHandlers.has(eventName)) {
            this.eventHandlers.set(eventName, []);
        }
        this.eventHandlers.get(eventName).push(handler);
        return this;
    }

    async call(routeName, params = null) {
        if (!this.connected) {
            throw new Error('Not connected to server');
        }

        const requestId = this._generateId();
        const message = {
            type: this.MSG_TYPES.REQUEST,
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
                route: routeName
            });

            this._send(message);
            this._log('debug', `Calling server route: ${routeName} (ID: ${requestId})`);
        });
    }

    async _handleMessage(data) {
        try {
            const message = JSON.parse(data);
            this._log('debug', `Received message: ${message.type}`);

            switch (message.type) {
                case this.MSG_TYPES.WELCOME:
                    this.clientId = message.client_id;
                    this._log('info', `Assigned client ID: ${this.clientId}`);
                    break;

                case this.MSG_TYPES.REQUEST:
                    await this._handleRequest(message);
                    break;

                case this.MSG_TYPES.RESPONSE:
                    await this._handleResponse(message);
                    break;

                case this.MSG_TYPES.EVENT:
                    await this._handleEvent(message);
                    break;

                case this.MSG_TYPES.ERROR:
                    this._log('error', `Server error: ${message.error}`);
                    this._emit('error', message);
                    break;

                case this.MSG_TYPES.PING:
                    await this._handlePing();
                    break;

                default:
                    this._log('warn', `Unknown message type: ${message.type}`);
            }
        } catch (error) {
            this._log('error', `Error handling message: ${error.message}`);
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
                    type: this.MSG_TYPES.RESPONSE,
                    id: requestId,
                    success: false,
                    code: this.ERROR_CODES.ROUTE_NOT_FOUND,
                    error: `Route not found: ${route}`,
                    timestamp: Date.now()
                });
                return;
            }

            const result = await handler(params);

            this._send({
                type: this.MSG_TYPES.RESPONSE,
                id: requestId,
                success: true,
                result: result,
                timestamp: Date.now()
            });
        } catch (error) {
            this._log('error', `Route error (${route}): ${error.message}`);

            this._send({
                type: this.MSG_TYPES.RESPONSE,
                id: requestId,
                success: false,
                code: this.ERROR_CODES.INTERNAL_ERROR,
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

        if (message.success) {
            pending.resolve(message.result);
        } else {
            const error = new Error(message.error || 'Unknown error');
            error.code = message.code;
            pending.reject(error);
        }

        this.pendingRequests.delete(requestId);
    }

    async _handleEvent(message) {
        const eventName = message.event;
        const data = message.data;
        this._emit(eventName, data);
    }

    async _handlePing() {
        this._send({
            type: this.MSG_TYPES.PONG,
            timestamp: Date.now()
        });
    }

    _startHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }

        this.heartbeatTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this._send({
                    type: this.MSG_TYPES.PING,
                    timestamp: Date.now()
                });
            }
        }, this.heartbeatInterval);
    }

    _stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    _send(message) {
        if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.messageQueue.push(message);
            this._log('debug', 'Message queued (not connected)');
            return;
        }

        this.ws.send(JSON.stringify(message));
    }

    async _flushMessageQueue() {
        if (this.messageQueue.length === 0) {
            return;
        }

        this._log('debug', `Flushing ${this.messageQueue.length} queued messages`);

        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.ws.send(JSON.stringify(message));
        }
    }

    async _attemptReconnect() {
        this.reconnectAttempts++;
        this._log('info', `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

        if (this.onReconnecting) {
            await this.onReconnecting(this.reconnectAttempts);
        }

        setTimeout(async () => {
            try {
                await this.connect();
            } catch (error) {
                this._log('error', `Reconnection attempt ${this.reconnectAttempts} failed: ${error.message}`);
            }
        }, this.reconnectInterval);
    }

    _emit(eventName, data) {
        const handlers = this.eventHandlers.get(eventName) || [];
        handlers.forEach(handler => {
            try {
                handler(data);
            } catch (error) {
                this._log('error', `Event handler error (${eventName}): ${error.message}`);
            }
        });
    }

    _generateId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    _log(level, message) {
        if (!this.debug && level === 'debug') {
            return;
        }

        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [WsRpcClient] [${level.toUpperCase()}]`;

        switch (level) {
            case 'error':
                console.error(prefix, message);
                break;
            case 'warn':
                console.warn(prefix, message);
                break;
            case 'info':
                console.info(prefix, message);
                break;
            case 'debug':
                console.log(prefix, message);
                break;
            default:
                console.log(prefix, message);
        }
    }
}

if (typeof window !== 'undefined') {
    window.WsRpcBrowserClient = WsRpcBrowserClient;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = WsRpcBrowserClient;
}
