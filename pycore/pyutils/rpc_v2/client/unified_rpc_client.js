/**
 * FastAPI RPC v2 client.
 *
 * Differences from legacy client:
 *  - WebSocket is always required; HTTP fallback is removed.
 *  - Detailed console logging of connection failures.
 */

(function (global, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define(factory);
    } else {
        global.FastAPIRpcClient = factory();
    }
})(typeof window !== 'undefined' ? window : this, function () {
    'use strict';

    const isBrowser = typeof window !== 'undefined';
    let WebSocketImpl = null;
    if (isBrowser) {
        WebSocketImpl = window.WebSocket || window.MozWebSocket;
    } else {
        try {
            WebSocketImpl = require('ws');
        } catch (err) {
            console.warn('FastAPIRpcClient: ws package missing', err);
        }
    }

    function uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function encodeJSON(payload) {
        try {
            return JSON.stringify(payload);
        } catch (err) {
            throw new Error(`Failed to encode payload: ${err.message}`);
        }
    }

    function decodeJSON(raw) {
        if (typeof raw !== 'string') {
            return raw;
        }
        try {
            return JSON.parse(raw);
        } catch (err) {
            throw new Error(`Invalid JSON payload: ${err.message}`);
        }
    }

    class FastAPIRpcClient {
        constructor(baseUrl, options = {}) {
            if (!baseUrl) {
                throw new Error('baseUrl required');
            }
            this.baseUrl = baseUrl.replace(/\/$/, '');
            this.storageKey = options.storageKey || 'fastapi_rpc_client_id';
            const clientId = this._resolveClientId(options.clientId);
            this.options = {
                ...options,
                wsPath: options.wsPath || '/rpc/ws',
                reconnect: options.reconnect !== false,
                reconnectInterval: options.reconnectInterval || 3000,
                maxReconnectAttempts: options.maxReconnectAttempts || 10,
                debug: !!options.debug,
                heartbeatFast: options.heartbeatFast || 1000,
                heartbeatInterval: options.heartbeatInterval || 5000,
                clientId,
            };
            this.ws = null;
            this.connected = false;
            this.pending = new Map();
            this.reconnectAttempts = 0;
            this.heartbeatTimer = null;
            this.routeHandlers = new Map();
            this.pendingMetadata = new Map();
            this.pendingStorageKey = options.pendingStorageKey || 'fastapi_rpc_pending';
            this._restorePendingMetadata();
        }

        _resolveClientId(pref) {
            if (pref) {
                return pref;
            }
            if (isBrowser && window.localStorage) {
                try {
                    let existing = localStorage.getItem(this.storageKey);
                    if (!existing) {
                        existing = uuid();
                        localStorage.setItem(this.storageKey, existing);
                    }
                    return existing;
                } catch (err) {
                    console.warn('[FastAPIRpcClient] localStorage unavailable', err);
                }
            }
            return uuid();
        }

        onEvent(route, handler) {
            if (typeof handler !== 'function') {
                throw new Error('Event handler must be a function');
            }
            this.routeHandlers.set(route, handler);
        }

        offEvent(route) {
            this.routeHandlers.delete(route);
        }

        connect() {
            if (!WebSocketImpl) {
                return Promise.reject(new Error('WebSocket implementation missing'));
            }
            return new Promise((resolve, reject) => {
                const wsUrl = this.baseUrl.replace(/^http/, 'ws') + this.options.wsPath + `?client_id=${this.options.clientId}`;
                if (this.options.debug) {
                    console.info('[FastAPIRpcClient] Connecting to', wsUrl);
                }

                const socket = new WebSocketImpl(wsUrl);
                this.ws = socket;

                socket.onopen = () => {
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    if (this.options.debug) {
                        console.info('[FastAPIRpcClient] WebSocket connected');
                    }
                    this._persistLog(`connected:${this.options.clientId}`);
                    this._startHeartbeat(true);
                    resolve();
                };

                socket.onmessage = (event) => {
                    try {
                        const payload = decodeJSON(event.data);
                        this._handleMessage(payload);
                    } catch (err) {
                        console.error('[FastAPIRpcClient] Invalid message', err);
                    }
                };

                socket.onerror = (err) => {
                    console.error('[FastAPIRpcClient] WebSocket error', err);
                    if (!this.connected) {
                        reject(err instanceof Error ? err : new Error('WebSocket error'));
                    }
                };

                socket.onclose = () => {
                    this.connected = false;
                    if (this.options.debug) {
                        console.warn('[FastAPIRpcClient] WebSocket closed');
                    }
                    this._stopHeartbeat();
                    this._handleDisconnect();
                };
            });
        }

        call(route, params = {}) {
            if (!this.connected || !this.ws) {
                return Promise.reject(new Error('WebSocket not connected'));
            }
            const requestId = uuid();
            const payload = {
                type: 'request',
                id: requestId,
                route,
                params,
            };
            return new Promise((resolve, reject) => {
                this.pending.set(requestId, { resolve, reject });
                this._recordPendingMetadata(requestId, route, 'websocket');
                this._updateHeartbeatInterval();
                this.ws.send(encodeJSON(payload));
            });
        }

        _handleMessage(message) {
            if (this.options.debug) {
                console.info('[FastAPIRpcClient] Message', message);
            }
            if (message.type === 'response' && message.id) {
                const entry = this.pending.get(message.id);
                if (entry) {
                    this.pending.delete(message.id);
                    this._removePendingMetadata(message.id);
                    this._updateHeartbeatInterval();
                    if (message.error) {
                        entry.reject(new Error(message.error));
                    } else {
                        entry.resolve(message.result);
                    }
                    if (message.requires_ack) {
                        this._sendAck(message.id);
                    }
                } else if (this.pendingMetadata.has(message.id)) {
                    this._handleRestoredMessage(message);
                }
            } else if (message.type === 'welcome') {
                if (this.options.debug) {
                    console.info('[FastAPIRpcClient] Welcome payload received');
                }
            } else if (message.type === 'event') {
                const eventName = message.route || message.event;
                if (eventName && this.routeHandlers.has(eventName)) {
                    try {
                        this.routeHandlers.get(eventName)(message.data || message);
                    } catch (err) {
                        console.error('[FastAPIRpcClient] Event handler error', err);
                    }
                }
            }
        }

        _sendAck(requestId) {
            if (!this.ws) return;
            const payload = { type: 'ack', id: requestId };
            this.ws.send(JSON.stringify(payload));
        }

        _handleDisconnect() {
            for (const [id, entry] of this.pending.entries()) {
                entry.reject(new Error('Connection lost'));
            }
            this.pending.clear();
            this._persistLog(`disconnect:${this.options.clientId}`);
            if (this.options.reconnect) {
                this._attemptReconnect();
            }
        }

        _attemptReconnect() {
            if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
                console.error('[FastAPIRpcClient] Max reconnect attempts reached');
                return;
            }
            this.reconnectAttempts += 1;
            setTimeout(() => {
                this.connect().catch((err) => {
                    console.error('[FastAPIRpcClient] Reconnect failed', err);
                    this._attemptReconnect();
                });
            }, this.options.reconnectInterval);
        }

        _startHeartbeat(forceRestart = false) {
            if (this.heartbeatTimer && !forceRestart) {
                return;
            }
            this._stopHeartbeat();
            const interval = this._getHeartbeatInterval();
            this.heartbeatTimer = setInterval(() => {
                this._sendPing();
            }, interval);
        }

        _stopHeartbeat() {
            if (this.heartbeatTimer) {
                clearInterval(this.heartbeatTimer);
                this.heartbeatTimer = null;
            }
        }

        _getHeartbeatInterval() {
            return this.pending.size > 0 ? this.options.heartbeatFast : this.options.heartbeatInterval;
        }

        _updateHeartbeatInterval() {
            if (this.connected) {
                this._startHeartbeat(true);
            }
        }

        _sendPing() {
            if (!this.connected || !this.ws) {
                return;
            }
            try {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            } catch (err) {
                if (this.options.debug) {
                    console.warn('[FastAPIRpcClient] Failed to send ping', err);
                }
            }
        }

        _recordPendingMetadata(requestId, route, transport) {
            this.pendingMetadata.set(requestId, {
                id: requestId,
                route,
                transport,
                createdAt: Date.now(),
            });
            this._persistPendingMetadata();
        }

        _removePendingMetadata(requestId) {
            if (this.pendingMetadata.delete(requestId)) {
                this._persistPendingMetadata();
            }
        }

        _persistPendingMetadata() {
            if (!isBrowser || !window.localStorage) {
                return;
            }
            try {
                const payload = Array.from(this.pendingMetadata.values());
                localStorage.setItem(this.pendingStorageKey, encodeJSON(payload));
            } catch (err) {
                console.warn('[FastAPIRpcClient] Failed to persist pending metadata', err);
            }
        }

        _restorePendingMetadata() {
            if (!isBrowser || !window.localStorage) {
                return;
            }
            try {
                const raw = localStorage.getItem(this.pendingStorageKey);
                if (!raw) {
                    return;
                }
                const list = decodeJSON(raw);
                if (Array.isArray(list)) {
                    list.forEach((entry) => {
                        if (entry && entry.id) {
                            this.pendingMetadata.set(entry.id, entry);
                        }
                    });
                }
            } catch (err) {
                console.warn('[FastAPIRpcClient] Failed to restore pending metadata', err);
            }
        }

        _handleRestoredMessage(message) {
            const metadata = this.pendingMetadata.get(message.id);
            if (!metadata) {
                return;
            }
            this._removePendingMetadata(message.id);
            const route = metadata.route || message.route;
            if (route && this.routeHandlers.has(route)) {
                try {
                    this.routeHandlers.get(route)(message);
                } catch (err) {
                    console.error('[FastAPIRpcClient] Restored handler error', err);
                }
            } else if (this.options.debug) {
                console.warn('[FastAPIRpcClient] No route handler for restored request', route);
            }
        }
    }

    return FastAPIRpcClient;
});
