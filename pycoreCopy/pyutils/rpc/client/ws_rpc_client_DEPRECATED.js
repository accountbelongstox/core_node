/**
 * WebSocket RPC Client - Frontend JavaScript Library
 * 
 * WebSocket-only client for communicating with UnifiedRpcServer.
 * 
 * Usage:
 *   const client = new WsRpcClient('ws://localhost:8080/rpc/ws');
 *   await client.connect();
 *   const result = await client.call('echo', { message: 'Hello' });
 */

(function (global, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define(factory);
    } else {
        global.WsRpcClient = factory();
    }
})(typeof window !== 'undefined' ? window : this, function () {
    'use strict';

    const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

    let WebSocket = null;

    if (isBrowser) {
        WebSocket = window.WebSocket || window.MozWebSocket;
    } else if (isNode) {
        try {
            WebSocket = require('ws');
        } catch (e) {
            console.warn('WsRpcClient: WebSocket library not available', e);
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

    class WsRpcClient {
        constructor(url, options = {}) {
            this.url = url;
            this.options = {
                timeout: options.timeout || 30000,
                reconnect: options.reconnect !== false,
                reconnectInterval: options.reconnectInterval || 3000,
                maxReconnectAttempts: options.maxReconnectAttempts || 10,
                heartbeatInterval: options.heartbeatInterval || 30000,
                enableHeartbeat: options.enableHeartbeat !== false,
                debug: options.debug || false,
                ...options
            };

            this.ws = null;
            this.connected = false;
            this.reconnectAttempts = 0;
            this.pendingRequests = new Map();
            this.eventHandlers = new Map();
            this.reconnectTimer = null;
            this.heartbeatTimer = null;
        }

        connect() {
            return new Promise((resolve, reject) => {
                if (!WebSocket) {
                    reject(new Error('WebSocket not available'));
                    return;
                }

                try {
                    this._log(`Connecting to ${this.url}...`);

                    this.ws = new WebSocket(this.url);

                    this.ws.onopen = () => {
                        this.connected = true;
                        this.reconnectAttempts = 0;
                        this._log('WebSocket connected');

                        if (this.options.enableHeartbeat) {
                            this._startHeartbeat();
                        }

                        this._emit(EVENTS.CONNECTION);
                        resolve();
                    };

                    this.ws.onmessage = (event) => {
                        this._handleMessage(event.data);
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
                        this._stopHeartbeat();
                        this._log('WebSocket disconnected');
                        this._emit(EVENTS.DISCONNECT);

                        if (this.options.reconnect) {
                            this._attemptReconnect();
                        }
                    };

                } catch (error) {
                    this._log('WebSocket connection error:', error);
                    reject(error);
                }
            });
        }

        _attemptReconnect() {
            if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
                this._emit(EVENTS.RECONNECT_FAILED);
                return;
            }

            this.reconnectAttempts++;
            this._log(`Attempting to reconnect (${this.reconnectAttempts}/${this.options.maxReconnectAttempts})...`);
            this._emit(EVENTS.RECONNECT, { attempt: this.reconnectAttempts });

            this.reconnectTimer = setTimeout(() => {
                if (!this.connected) {
                    this.connect().catch(() => {
                        this._attemptReconnect();
                    });
                }
            }, this.options.reconnectInterval);
        }

        _handleMessage(data) {
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
                this._log('Error handling message:', error);
                this._emit(EVENTS.ERROR, error);
            }
        }

        async call(route, params = {}, options = {}) {
            if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
                throw new Error('WebSocket not connected');
            }

            const requestId = generateUUID();
            const timeout = options.timeout || this.options.timeout;

            return new Promise((resolve, reject) => {
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
            });
        }

        ping() {
            if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: MSG_TYPES.PING,
                    timestamp: Date.now()
                }));
            }
        }

        _startHeartbeat() {
            this._stopHeartbeat();
            this.heartbeatTimer = setInterval(() => {
                this.ping();
            }, this.options.heartbeatInterval);
        }

        _stopHeartbeat() {
            if (this.heartbeatTimer) {
                clearInterval(this.heartbeatTimer);
                this.heartbeatTimer = null;
            }
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
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }

            this._stopHeartbeat();

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
            return this.connected && this.ws && this.ws.readyState === WebSocket.OPEN;
        }

        _log(...args) {
            if (this.options.debug) {
                console.log('[WsRpcClient]', ...args);
            }
        }
    }

    return WsRpcClient;
});

