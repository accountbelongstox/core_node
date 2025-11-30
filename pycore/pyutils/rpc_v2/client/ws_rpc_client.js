/**
 * FastAPI WebSocket RPC Client - WS only.
 */

(function (global, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define(factory);
    } else {
        global.FastAPIWsRpcClient = factory();
    }
})(typeof window !== 'undefined' ? window : this, function () {
    'use strict';

    const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

    let WebSocketImpl = null;
    if (isBrowser) {
        WebSocketImpl = window.WebSocket || window.MozWebSocket;
    } else if (isNode) {
        try {
            WebSocketImpl = require('ws');
        } catch (err) {
            console.warn('FastAPIWsRpcClient: ws package missing', err);
        }
    }

    function uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    const EVENTS = {
        CONNECTION: 'connection',
        DISCONNECT: 'disconnect',
        ERROR: 'error',
        RECONNECT: 'reconnect',
        RECONNECT_FAILED: 'reconnect_failed',
    };

    class FastAPIWsRpcClient {
        constructor(url, options = {}) {
            this.url = url;
            this.options = {
                timeout: options.timeout || 30000,
                reconnect: options.reconnect !== false,
                reconnectInterval: options.reconnectInterval || 3000,
                maxReconnectAttempts: options.maxReconnectAttempts || 10,
                debug: !!options.debug,
            };
            this.ws = null;
            this.connected = false;
            this.reconnectAttempts = 0;
            this.pending = new Map();
            this.handlers = new Map();
        }

        connect() {
            return new Promise((resolve, reject) => {
                if (!WebSocketImpl) {
                    reject(new Error('WebSocket not available'));
                    return;
                }
                const socket = new WebSocketImpl(this.url);
                this.ws = socket;

                socket.onopen = () => {
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    this._emit(EVENTS.CONNECTION);
                    resolve();
                };

                socket.onmessage = (event) => {
                    try {
                        const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                        this._handleMessage(payload);
                    } catch (err) {
                        console.error('[FastAPIWsRpcClient] Invalid message', err);
                    }
                };

                socket.onerror = (err) => {
                    this._emit(EVENTS.ERROR, err);
                    if (!this.connected) {
                        reject(err instanceof Error ? err : new Error('WebSocket error'));
                    }
                };

                socket.onclose = () => {
                    this.connected = false;
                    this._emit(EVENTS.DISCONNECT);
                    this._handleDisconnect();
                };
            });
        }

        call(route, params = {}, timeout = 30000) {
            if (!this.connected || !this.ws) {
                return Promise.reject(new Error('WebSocket not connected'));
            }
            const requestId = uuid();
            const payload = { type: 'request', id: requestId, route, params };

            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    this.pending.delete(requestId);
                    reject(new Error('Request timeout'));
                }, timeout);

                this.pending.set(requestId, { resolve, reject, timer });
                this.ws.send(JSON.stringify(payload));
            });
        }

        on(event, handler) {
            this.handlers.set(event, handler);
        }

        _emit(event, data) {
            const handler = this.handlers.get(event);
            if (handler) {
                handler(data);
            }
        }

        _handleMessage(message) {
            if (message.type === 'response' && message.id) {
                const entry = this.pending.get(message.id);
                if (entry) {
                    clearTimeout(entry.timer);
                    this.pending.delete(message.id);
                    if (message.error) {
                        entry.reject(new Error(message.error));
                    } else {
                        entry.resolve(message.result);
                    }
                    if (message.requires_ack) {
                        this._sendAck(message.id);
                    }
                }
            } else if (message.type === 'event') {
                this._emit('event', message);
            }
        }

        _sendAck(requestId) {
            if (!this.ws) return;
            this.ws.send(JSON.stringify({ type: 'ack', id: requestId }));
        }

        _handleDisconnect() {
            for (const [id, entry] of this.pending.entries()) {
                clearTimeout(entry.timer);
                entry.reject(new Error('Connection lost'));
            }
            this.pending.clear();
            if (this.options.reconnect) {
                this._attemptReconnect();
            }
        }

        _attemptReconnect() {
            if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
                this._emit(EVENTS.RECONNECT_FAILED);
                return;
            }
            this.reconnectAttempts += 1;
            this._emit(EVENTS.RECONNECT, { attempt: this.reconnectAttempts });
            setTimeout(() => {
                this.connect().catch(() => this._attemptReconnect());
            }, this.options.reconnectInterval);
        }
    }

    return FastAPIWsRpcClient;
});
