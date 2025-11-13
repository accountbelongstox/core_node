/**
 * Unified RPC Client - Frontend JavaScript Library
 * 
 * A unified client for communicating with UnifiedRpcServer.
 * Automatically uses WebSocket when available, falls back to HTTP.
 * 
 * Compatible with both browser and Node.js environments.
 * 
 * Usage:
 *   const client = new UnifiedRpcClient('http://localhost:8080');
 *   await client.connect();
 *   const result = await client.call('echo', { message: 'Hello' });
 */

(function (global, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define(factory);
    } else {
        global.UnifiedRpcClient = factory();
    }
})(typeof window !== 'undefined' ? window : this, function () {
    'use strict';

    const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

    let WebSocket = null;
    let http = null;
    let https = null;

    if (isBrowser) {
        WebSocket = window.WebSocket || window.MozWebSocket;
    } else if (isNode) {
        try {
            WebSocket = require('ws');
            http = require('http');
            https = require('https');
        } catch (e) {
            console.warn('UnifiedRpcClient: Dependencies not available', e);
        }
    }

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    const MSG_TYPES = {
        REQUEST: 'request',
        RESPONSE: 'response',
        EVENT: 'event',
        WELCOME: 'welcome',
        ERROR: 'error',
        PING: 'ping',
        PONG: 'pong'
    };

    const ERROR_CODES = {
        ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
        TIMEOUT: 'TIMEOUT',
        UNAUTHORIZED: 'UNAUTHORIZED',
        FORBIDDEN: 'FORBIDDEN',
        PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
        INTERNAL_ERROR: 'INTERNAL_ERROR',
        INVALID_MESSAGE: 'INVALID_MESSAGE',
        CONNECTION_LOST: 'CONNECTION_LOST',
        CANCELLED: 'CANCELLED'
    };

    const EVENTS = {
        CONNECTION: 'connection',
        DISCONNECT: 'disconnect',
        ERROR: 'error',
        RECONNECT: 'reconnect',
        RECONNECT_FAILED: 'reconnect_failed'
    };

    class UnifiedRpcClient {
        constructor(baseUrl, options = {}) {
            this.baseUrl = baseUrl.replace(/\/$/, '');
            this.options = {
                clientId: options.clientId || generateUUID(),
                timeout: options.timeout || 30000,
                reconnect: options.reconnect !== false,
                reconnectInterval: options.reconnectInterval || 3000,
                maxReconnectAttempts: options.maxReconnectAttempts || 10,
                httpFallback: options.httpFallback !== false,
                preferWebSocket: options.preferWebSocket !== false,
                wsPath: options.wsPath || '/rpc/ws',
                httpPath: options.httpPath || '/rpc',
                debug: options.debug || false,
                ...options
            };

            this.mode = null;
            this.ws = null;
            this.connected = false;
            this.reconnectAttempts = 0;
            this.pendingRequests = new Map();
            this.eventHandlers = new Map();
            this.reconnectTimer = null;
        }

        async connect() {
            return new Promise((resolve, reject) => {
                if (this.options.preferWebSocket && WebSocket) {
                    this._connectWebSocket()
                        .then(resolve)
                        .catch((error) => {
                            if (this.options.httpFallback) {
                                this._log('WebSocket connection failed, falling back to HTTP');
                                this._connectHttp()
                                    .then(resolve)
                                    .catch(reject);
                            } else {
                                reject(error);
                            }
                        });
                } else {
                    this._connectHttp()
                        .then(resolve)
                        .catch(reject);
                }
            });
        }

        _connectWebSocket() {
            return new Promise((resolve, reject) => {
                try {
                    const wsUrl = this.baseUrl.replace(/^http/, 'ws') + this.options.wsPath;
                    this._log(`Connecting to WebSocket: ${wsUrl}`);

                    this.ws = new WebSocket(wsUrl);

                    this.ws.onopen = () => {
                        this.connected = true;
                        this.mode = 'ws';
                        this.reconnectAttempts = 0;
                        this._log('WebSocket connected');
                        this._emit(EVENTS.CONNECTION, { mode: 'websocket' });
                        resolve();
                    };

                    this.ws.onmessage = (event) => {
                        this._handleWebSocketMessage(event.data);
                    };

                    this.ws.onerror = (error) => {
                        this._log('WebSocket error:', error);
                        this._emit(EVENTS.ERROR, error);
                        if (!this.connected) {
                            reject(error);
                        }
                    };

                    this.ws.onclose = () => {
                        this.connected = false;
                        this._log('WebSocket disconnected');
                        this._emit(EVENTS.DISCONNECT, { mode: 'websocket' });

                        if (this.options.reconnect && this.mode === 'ws') {
                            this._attemptReconnect();
                        }
                    };

                } catch (error) {
                    this._log('WebSocket connection error:', error);
                    reject(error);
                }
            });
        }

        _connectHttp() {
            this.mode = 'http';
            this.connected = true;
            this._log('Using HTTP mode');
            this._emit(EVENTS.CONNECTION, { mode: 'http' });
            return Promise.resolve();
        }

        _attemptReconnect() {
            if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
                this._emit(EVENTS.RECONNECT_FAILED);
                if (this.options.httpFallback && this.mode === 'ws') {
                    this._log('Max reconnect attempts reached, falling back to HTTP');
                    this._connectHttp();
                }
                return;
            }

            this.reconnectAttempts++;
            this._log(`Attempting to reconnect (${this.reconnectAttempts}/${this.options.maxReconnectAttempts})...`);
            this._emit(EVENTS.RECONNECT, { attempt: this.reconnectAttempts });

            this.reconnectTimer = setTimeout(() => {
                if (!this.connected) {
                    this._connectWebSocket().catch(() => {
                        if (this.options.httpFallback) {
                            this._connectHttp();
                        }
                    });
                }
            }, this.options.reconnectInterval);
        }

        _handleWebSocketMessage(data) {
            try {
                const message = typeof data === 'string' ? JSON.parse(data) : data;

                if (message.type === MSG_TYPES.WELCOME) {
                    this._log('Received welcome message:', message);
                    return;
                }

                if (message.type === MSG_TYPES.RESPONSE) {
                    const pending = this.pendingRequests.get(message.id);
                    if (pending) {
                        clearTimeout(pending.timeout);
                        this.pendingRequests.delete(message.id);

                        if (message.success) {
                            pending.resolve(message.result);
                        } else {
                            pending.reject(new Error(message.error || message.message || 'Request failed'));
                        }
                    }
                } else if (message.type === MSG_TYPES.ERROR) {
                    const pending = this.pendingRequests.get(message.id);
                    if (pending) {
                        clearTimeout(pending.timeout);
                        this.pendingRequests.delete(message.id);
                        pending.reject(new Error(message.error || message.message || 'Unknown error'));
                    }
                } else if (message.type === MSG_TYPES.EVENT) {
                    this._emit(message.event || 'message', message.data);
                } else if (message.type === MSG_TYPES.PONG) {
                    this._log('Received pong');
                }

            } catch (error) {
                this._log('Error handling WebSocket message:', error);
                this._emit(EVENTS.ERROR, error);
            }
        }

        async call(route, params = {}, options = {}) {
            const requestId = generateUUID();
            const timeout = options.timeout || this.options.timeout;

            return new Promise((resolve, reject) => {
                if (this.mode === 'ws' && this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this._callWebSocket(requestId, route, params, timeout, resolve, reject);
                } else {
                    this._callHttp(requestId, route, params, timeout, resolve, reject);
                }
            });
        }

        _callWebSocket(requestId, route, params, timeout, resolve, reject) {
            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('Request timeout'));
            }, timeout);

            this.pendingRequests.set(requestId, { resolve, reject, timeout: timeoutId });

            const message = {
                type: MSG_TYPES.REQUEST,
                id: requestId,
                route: route,
                params: params
            };

            try {
                this.ws.send(JSON.stringify(message));
            } catch (error) {
                clearTimeout(timeoutId);
                this.pendingRequests.delete(requestId);
                reject(error);
            }
        }

        _callHttp(requestId, route, params, timeout, resolve, reject) {
            const url = `${this.baseUrl}${this.options.httpPath}/${route}`;
            const requestData = {
                id: requestId,
                route: route,
                params: params
            };

            const timeoutId = setTimeout(() => {
                reject(new Error('Request timeout'));
            }, timeout);

            this._httpPost(url, requestData)
                .then((response) => {
                    clearTimeout(timeoutId);
                    if (response.success) {
                        resolve(response.result);
                    } else {
                        reject(new Error(response.error || response.message || 'Request failed'));
                    }
                })
                .catch((error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
        }

        _httpPost(url, data) {
            if (isBrowser) {
                return fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    return response.json();
                });
            } else {
                return this._nodeHttpRequest(url, 'POST', data);
            }
        }

        _nodeHttpRequest(url, method, data = null) {
            return new Promise((resolve, reject) => {
                try {
                    const urlObj = new URL(url);
                    const lib = urlObj.protocol === 'https:' ? https : http;

                    const options = {
                        hostname: urlObj.hostname,
                        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                        path: urlObj.pathname + urlObj.search,
                        method: method,
                        headers: data ? {
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(JSON.stringify(data))
                        } : {}
                    };

                    const req = lib.request(options, (res) => {
                        let body = '';
                        res.on('data', chunk => body += chunk);
                        res.on('end', () => {
                            try {
                                resolve(JSON.parse(body));
                            } catch (e) {
                                reject(new Error(`Failed to parse response: ${e.message}`));
                            }
                        });
                    });

                    req.on('error', reject);

                    if (data) {
                        req.write(JSON.stringify(data));
                    }

                    req.end();
                } catch (error) {
                    reject(error);
                }
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

        ping() {
            if (this.mode === 'ws' && this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: MSG_TYPES.PING,
                    timestamp: Date.now()
                }));
            }
        }

        async healthCheck() {
            try {
                const url = `${this.baseUrl}/health`;
                if (isBrowser) {
                    const response = await fetch(url);
                    return await response.json();
                } else {
                    return await this._nodeHttpRequest(url, 'GET');
                }
            } catch (error) {
                return { status: 'error', error: error.message };
            }
        }

        close() {
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }

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
            this.mode = null;
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

        _log(...args) {
            if (this.options.debug) {
                console.log('[UnifiedRpcClient]', ...args);
            }
        }
    }

    return UnifiedRpcClient;
});

