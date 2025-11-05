(function (global, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define(factory);
    } else {
        global.UnifiedRpcClient = factory();
    }
})(typeof window !== 'undefined' ? window : this, function () {
    const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

    let WebSocket = null;
    let http = null;
    let https = null;
    let uuidv4 = null;

    if (isBrowser) {
        WebSocket = window.WebSocket || window.MozWebSocket;
        uuidv4 = function () {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        };
    } else if (isNode) {
        try {
            WebSocket = require('ws');
            http = require('http');
            https = require('https');
            const uuid = require('uuid');
            uuidv4 = uuid.v4;
        } catch (e) {
            console.warn('UnifiedRpcClient: Dependencies not available', e);
        }
    }

    const MSG_TYPES = {
        REQUEST: 'request',
        RESPONSE: 'response',
        EVENT: 'event',
        ERROR: 'error'
    };

    class UnifiedRpcClient {
        constructor(baseUrl, options = {}) {
            this.baseUrl = baseUrl;
            this.options = {
                clientId: options.clientId || uuidv4(),
                timeout: options.timeout || 30000,
                reconnect: options.reconnect !== false,
                reconnectInterval: options.reconnectInterval || 3000,
                maxReconnectAttempts: options.maxReconnectAttempts || 10,
                httpPollInterval: options.httpPollInterval || 1500,
                httpFallback: options.httpFallback !== false,
                ...options
            };

            this.mode = 'ws';
            this.ws = null;
            this.connected = false;
            this.reconnectAttempts = 0;
            this.pendingRequests = new Map();
            this.eventHandlers = new Map();

            this._tryWebSocketFirst();
        }

        _tryWebSocketFirst() {
            if (!this.options.httpFallback && !WebSocket) {
                throw new Error('WebSocket not available and HTTP fallback disabled');
            }

            if (WebSocket) {
                this._connectWebSocket();
            } else {
                this._fallbackToHttp();
            }
        }

        _connectWebSocket() {
            try {
                const wsUrl = this.baseUrl.replace(/^http/, 'ws');
                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    this.connected = true;
                    this.mode = 'ws';
                    this.reconnectAttempts = 0;
                    this._emit('connected', { mode: 'websocket' });

                    this.ws.send(JSON.stringify({
                        type: 'init',
                        clientId: this.options.clientId
                    }));
                };

                this.ws.onmessage = (event) => {
                    this._handleWebSocketMessage(event.data);
                };

                this.ws.onerror = (error) => {
                    this._emit('error', error);

                    if (!this.connected && this.options.httpFallback) {
                        this._fallbackToHttp();
                    }
                };

                this.ws.onclose = () => {
                    this.connected = false;
                    this._emit('disconnected', { mode: 'websocket' });

                    if (this.options.reconnect && this.mode === 'ws') {
                        this._attemptReconnect();
                    }
                };

            } catch (error) {
                if (this.options.httpFallback) {
                    this._fallbackToHttp();
                } else {
                    throw error;
                }
            }
        }

        _fallbackToHttp() {
            this.mode = 'http';
            this.connected = true;
            this._emit('connected', { mode: 'http' });
        }

        _attemptReconnect() {
            if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
                this._emit('reconnect_failed');

                if (this.options.httpFallback) {
                    this._fallbackToHttp();
                }
                return;
            }

            this.reconnectAttempts++;

            setTimeout(() => {
                if (!this.connected) {
                    this._emit('reconnecting', { attempt: this.reconnectAttempts });
                    this._connectWebSocket();
                }
            }, this.options.reconnectInterval);
        }

        _handleWebSocketMessage(data) {
            try {
                const message = JSON.parse(data);

                if (message.type === MSG_TYPES.RESPONSE) {
                    const pending = this.pendingRequests.get(message.id);
                    if (pending) {
                        clearTimeout(pending.timeout);
                        this.pendingRequests.delete(message.id);

                        if (message.success) {
                            pending.resolve(message.result);
                        } else {
                            pending.reject(new Error(message.error || 'Request failed'));
                        }
                    }
                } else if (message.type === MSG_TYPES.EVENT) {
                    this._emit(message.event, message.data);
                } else if (message.type === MSG_TYPES.ERROR) {
                    const pending = this.pendingRequests.get(message.id);
                    if (pending) {
                        clearTimeout(pending.timeout);
                        this.pendingRequests.delete(message.id);
                        pending.reject(new Error(message.error || 'Unknown error'));
                    }
                }
            } catch (error) {
                this._emit('error', error);
            }
        }

        async call(route, params = {}) {
            const requestId = uuidv4();

            return new Promise((resolve, reject) => {
                if (this.mode === 'ws' && this.connected && this.ws) {
                    this._callWebSocket(requestId, route, params, resolve, reject);
                } else {
                    this._callHttp(requestId, route, params, resolve, reject);
                }
            });
        }

        _callWebSocket(requestId, route, params, resolve, reject) {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('Request timeout'));
            }, this.options.timeout);

            this.pendingRequests.set(requestId, { resolve, reject, timeout });

            this.ws.send(JSON.stringify({
                type: MSG_TYPES.REQUEST,
                id: requestId,
                route,
                params,
                clientId: this.options.clientId
            }));
        }

        _callHttp(requestId, route, params, resolve, reject) {
            const requestData = {
                type: MSG_TYPES.REQUEST,
                id: requestId,
                route,
                params,
                clientId: this.options.clientId
            };

            this._httpPost(this.baseUrl, requestData)
                .then((response) => {
                    if (response.success) {
                        resolve(response.result);
                    } else {
                        this._startHttpPolling(requestId, resolve, reject);
                    }
                })
                .catch(() => {
                    this._startHttpPolling(requestId, resolve, reject);
                });
        }

        _startHttpPolling(requestId, resolve, reject) {
            const startTime = Date.now();
            const pollInterval = this.options.httpPollInterval;

            const poll = () => {
                if (Date.now() - startTime > this.options.timeout) {
                    reject(new Error('Request timeout'));
                    return;
                }

                this._httpGet(`${this.baseUrl}/query/${requestId}`)
                    .then((response) => {
                        if (response.success) {
                            resolve(response.result);
                        } else if (response.error === 'Response not found or expired') {
                            setTimeout(poll, pollInterval);
                        } else {
                            reject(new Error(response.error || 'Request failed'));
                        }
                    })
                    .catch(() => {
                        setTimeout(poll, pollInterval);
                    });
            };

            setTimeout(poll, pollInterval);
        }

        _httpPost(url, data) {
            if (isBrowser) {
                return fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                }).then(res => res.json());
            } else {
                return this._nodeHttpRequest(url, 'POST', data);
            }
        }

        _httpGet(url) {
            if (isBrowser) {
                return fetch(url).then(res => res.json());
            } else {
                return this._nodeHttpRequest(url, 'GET');
            }
        }

        _nodeHttpRequest(url, method, data = null) {
            return new Promise((resolve, reject) => {
                const urlObj = new URL(url);
                const lib = urlObj.protocol === 'https:' ? https : http;

                const options = {
                    hostname: urlObj.hostname,
                    port: urlObj.port,
                    path: urlObj.pathname + urlObj.search,
                    method,
                    headers: data ? { 'Content-Type': 'application/json' } : {}
                };

                const req = lib.request(options, (res) => {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => {
                        try {
                            resolve(JSON.parse(body));
                        } catch (e) {
                            reject(e);
                        }
                    });
                });

                req.on('error', reject);

                if (data) {
                    req.write(JSON.stringify(data));
                }

                req.end();
            });
        }

        on(event, handler) {
            if (!this.eventHandlers.has(event)) {
                this.eventHandlers.set(event, []);
            }
            this.eventHandlers.get(event).push(handler);
        }

        off(event, handler) {
            const handlers = this.eventHandlers.get(event);
            if (handlers) {
                const index = handlers.indexOf(handler);
                if (index !== -1) {
                    handlers.splice(index, 1);
                }
            }
        }

        _emit(event, data) {
            const handlers = this.eventHandlers.get(event);
            if (handlers) {
                handlers.forEach(handler => {
                    try {
                        handler(data);
                    } catch (error) {
                        console.error('Event handler error:', error);
                    }
                });
            }
        }

        close() {
            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }

            this.pendingRequests.forEach(({ timeout, reject }) => {
                clearTimeout(timeout);
                reject(new Error('Client closed'));
            });

            this.pendingRequests.clear();
            this.connected = false;
        }

        isConnected() {
            return this.connected;
        }

        getMode() {
            return this.mode;
        }

        getClientId() {
            return this.options.clientId;
        }
    }

    return UnifiedRpcClient;
});
