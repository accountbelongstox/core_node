class WsRpcBrowserClient {
    constructor(url, options = {}) {
        this.url = url;
        this.debug = options.debug || false;
        this.ws = null;
        this.connected = false;
        this.clientId = null;

        this.httpUrl = options.httpUrl || this._deriveHttpUrl(url);
        this.enableHttp = options.enableHttp !== false;
        this.preferWebSocket = options.preferWebSocket !== false;
        this.httpPollingInterval = options.httpPollingInterval || 1000;
        this.httpMaxPollingAttempts = options.httpMaxPollingAttempts || 60;

        this.enablePersistence = options.enablePersistence !== false;
        this.storagePrefix = options.storagePrefix || 'wsrpc_';

        this.routes = new Map();
        this.pendingRequests = new Map();
        this.messageQueue = [];
        this.eventHandlers = new Map();
        this.pollingTimers = new Map();

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

        if (this.enablePersistence) {
            this._loadPersistedRequests();
        }

        this.on('result_ready', (data) => {
            this._handleResultReady(data);
        });
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

                    if (!this.connected && this.enableHttp) {
                        this._log('info', 'WebSocket connection failed, HTTP mode available');
                        resolve();
                    } else {
                        reject(error);
                    }
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

        this.pollingTimers.forEach(timer => clearTimeout(timer));
        this.pollingTimers.clear();

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

    async call(routeName, params = null, options = {}) {
        const requestId = options.requestId || this._generateId();

        if (this.enablePersistence) {
            this._persistRequest(requestId, { route: routeName, params, timestamp: Date.now() });
        }

        if (this.connected && this.preferWebSocket) {
            try {
                const result = await this._callViaWebSocket(routeName, params, requestId);
                if (this.enablePersistence) {
                    this._removePersistedRequest(requestId);
                }
                return result;
            } catch (error) {
                this._log('warn', `WebSocket call failed: ${error.message}, trying HTTP...`);

                if (this.enableHttp) {
                    return await this._callViaHttp(requestId, routeName, params, options);
                }

                throw error;
            }
        } else if (this.enableHttp) {
            return await this._callViaHttp(requestId, routeName, params, options);
        } else {
            throw new Error('Not connected and HTTP is disabled');
        }
    }

    async _callViaWebSocket(routeName, params, requestId) {
        if (!this.connected) {
            throw new Error('Not connected to server');
        }

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

    async _callViaHttp(requestId, routeName, params, options = {}) {
        const usePolling = options.polling !== false;

        const requestData = {
            requestId,
            route: routeName,
            params,
            clientId: this.clientId
        };

        if (options.delay) {
            requestData.delay = options.delay;
        }

        try {
            const response = await this._httpRequest(
                `${this.httpUrl}/api/request`,
                'POST',
                requestData
            );

            if (response.status === 'completed') {
                if (this.enablePersistence) {
                    this._removePersistedRequest(requestId);
                }
                return response.result;
            } else if (response.status === 'scheduled' || response.status === 'pending') {
                if (usePolling) {
                    return await this._pollForResult(requestId);
                } else {
                    return { requestId, status: response.status };
                }
            } else {
                throw new Error(response.error || 'Unknown error');
            }
        } catch (error) {
            this._log('error', `HTTP call error: ${error.message}`);
            throw error;
        }
    }

    async _pollForResult(requestId, attempt = 0) {
        if (attempt >= this.httpMaxPollingAttempts) {
            throw new Error(`Polling timeout for request ${requestId}`);
        }

        try {
            const response = await this._httpRequest(
                `${this.httpUrl}/api/result?requestId=${requestId}`,
                'GET'
            );

            if (response.success) {
                if (this.enablePersistence) {
                    this._removePersistedRequest(requestId);
                }

                this._stopPolling(requestId);
                return response.result;
            } else if (response.status === 'pending') {
                return new Promise((resolve, reject) => {
                    const timer = setTimeout(async () => {
                        try {
                            const result = await this._pollForResult(requestId, attempt + 1);
                            resolve(result);
                        } catch (error) {
                            reject(error);
                        }
                    }, this.httpPollingInterval);

                    this.pollingTimers.set(requestId, timer);
                });
            } else {
                throw new Error(response.error || 'Result not available');
            }
        } catch (error) {
            this._log('error', `Polling error: ${error.message}`);
            throw error;
        }
    }

    async getResult(requestId) {
        if (this.enableHttp) {
            try {
                const response = await this._httpRequest(
                    `${this.httpUrl}/api/result?requestId=${requestId}`,
                    'GET'
                );

                if (response.success) {
                    return response.result;
                } else {
                    return null;
                }
            } catch (error) {
                this._log('error', `Get result error: ${error.message}`);
                return null;
            }
        }

        return null;
    }

    async getStatus(requestId) {
        if (this.enableHttp) {
            try {
                const response = await this._httpRequest(
                    `${this.httpUrl}/api/status?requestId=${requestId}`,
                    'GET'
                );

                return response;
            } catch (error) {
                this._log('error', `Get status error: ${error.message}`);
                return null;
            }
        }

        return null;
    }

    _stopPolling(requestId) {
        const timer = this.pollingTimers.get(requestId);
        if (timer) {
            clearTimeout(timer);
            this.pollingTimers.delete(requestId);
        }
    }

    async _httpRequest(url, method, data = null) {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (data && method === 'POST') {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            const result = await response.json();
            return result;
        } catch (error) {
            throw new Error(`HTTP request failed: ${error.message}`);
        }
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

    async _handleResultReady(data) {
        const { requestId, result } = data;
        this._log('info', `Result ready for request: ${requestId}`);

        if (this.enablePersistence) {
            this._removePersistedRequest(requestId);
        }

        const pending = this.pendingRequests.get(requestId);
        if (pending) {
            if (pending.timeout) {
                clearTimeout(pending.timeout);
            }
            pending.resolve(result);
            this.pendingRequests.delete(requestId);
        }
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

    _persistRequest(requestId, data) {
        if (!this.enablePersistence) return;

        try {
            const key = this._getStorageKey('request', requestId);
            const value = JSON.stringify({
                ...data,
                persistedAt: Date.now()
            });
            localStorage.setItem(key, value);
        } catch (error) {
            this._log('error', `Failed to persist request: ${error.message}`);
        }
    }

    _removePersistedRequest(requestId) {
        if (!this.enablePersistence) return;

        try {
            const key = this._getStorageKey('request', requestId);
            localStorage.removeItem(key);
        } catch (error) {
            this._log('error', `Failed to remove persisted request: ${error.message}`);
        }
    }

    _loadPersistedRequests() {
        if (!this.enablePersistence) return;

        try {
            const prefix = this._getStorageKey('request', '');
            const keys = [];

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    keys.push(key);
                }
            }

            this._log('info', `Found ${keys.length} persisted requests`);

            for (const key of keys) {
                const value = localStorage.getItem(key);
                if (value) {
                    try {
                        const data = JSON.parse(value);
                        this._log('debug', `Loaded persisted request: ${key}`, data);
                    } catch (error) {
                        this._log('error', `Failed to parse persisted request: ${error.message}`);
                    }
                }
            }
        } catch (error) {
            this._log('error', `Failed to load persisted requests: ${error.message}`);
        }
    }

    getPersistedRequests() {
        if (!this.enablePersistence) return [];

        const requests = [];
        const prefix = this._getStorageKey('request', '');

        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    const value = localStorage.getItem(key);
                    if (value) {
                        const data = JSON.parse(value);
                        const requestId = key.substring(prefix.length);
                        requests.push({ requestId, ...data });
                    }
                }
            }
        } catch (error) {
            this._log('error', `Failed to get persisted requests: ${error.message}`);
        }

        return requests;
    }

    clearPersistedRequests() {
        if (!this.enablePersistence) return;

        const prefix = this._getStorageKey('request', '');
        const keys = [];

        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    keys.push(key);
                }
            }

            for (const key of keys) {
                localStorage.removeItem(key);
            }

            this._log('info', `Cleared ${keys.length} persisted requests`);
        } catch (error) {
            this._log('error', `Failed to clear persisted requests: ${error.message}`);
        }
    }

    _getStorageKey(type, id) {
        return `${this.storagePrefix}${type}_${id}`;
    }

    _deriveHttpUrl(wsUrl) {
        const url = wsUrl.replace('ws://', 'http://').replace('wss://', 'https://');
        const match = url.match(/^(https?:\/\/[^:]+):(\d+)/);

        if (match) {
            const baseUrl = match[1];
            const port = parseInt(match[2]) + 1;
            return `${baseUrl}:${port}`;
        }

        return url;
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

    _log(level, message, data = null) {
        if (!this.debug && level === 'debug') {
            return;
        }

        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [WsRpcClient] [${level.toUpperCase()}]`;

        const args = data ? [prefix, message, data] : [prefix, message];

        switch (level) {
            case 'error':
                console.error(...args);
                break;
            case 'warn':
                console.warn(...args);
                break;
            case 'info':
                console.info(...args);
                break;
            case 'debug':
                console.log(...args);
                break;
            default:
                console.log(...args);
        }
    }
}

if (typeof window !== 'undefined') {
    window.WsRpcBrowserClient = WsRpcBrowserClient;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = WsRpcBrowserClient;
}
