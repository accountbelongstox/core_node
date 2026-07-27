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

    // Stable per-window client id so the server keys this client consistently across
    // reconnects/reloads (no accumulation of dead sessions). sessionStorage = per-tab
    // + survives reload; falls back to an in-memory id when storage is unavailable.
    function getCachedClientId() {
        var KEY = 'pycore_ws_client_id';
        try {
            if (isBrowser && window.sessionStorage) {
                var s = window.sessionStorage.getItem(KEY);
                if (s) return s;
                var id = 'rpc-' + uuid();
                window.sessionStorage.setItem(KEY, id);
                return id;
            }
        } catch (e) { /* storage blocked: fall through to in-memory id */ }
        return 'rpc-' + uuid();
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
            // Stable client id sent as ?client_id= so the server can re-identify this
            // client across reconnects (pass options.clientId to override).
            this.clientId = options.clientId || getCachedClientId();
            this.options = {
                timeout: options.timeout || 30000,
                reconnect: options.reconnect !== false,
                reconnectInterval: options.reconnectInterval || 3000,
                maxReconnectAttempts: options.maxReconnectAttempts || 10,
                debug: !!options.debug,
            };
            this.ws = null;
            this.connected = false;
            this._connectResolve = null;
            this._connectReject = null;
            this.reconnectAttempts = 0;
            this.pending = new Map();
            this.handlers = new Map();
            this.connectionId = null;
            this.lastAckedSeq = 0;
            this.resumeToken = null;
            this._seenEventIds = new Set();
        }

        _urlWithClientId() {
            if (!this.clientId) return this.url;
            return this.url + (this.url.indexOf('?') >= 0 ? '&' : '?')
                + 'client_id=' + encodeURIComponent(this.clientId);
        }

        connect() {
            return new Promise((resolve, reject) => {
                if (!WebSocketImpl) {
                    reject(new Error('WebSocket not available'));
                    return;
                }
                const socket = new WebSocketImpl(this._urlWithClientId());
                this.ws = socket;

                socket.onopen = () => {
                    this.reconnectAttempts = 0;
                    const hello = {
                        type: 'hello',
                        client_id: this.clientId,
                        last_acked_seq: this.lastAckedSeq,
                        capabilities: { ack: true, replay: true },
                    };
                    if (this.resumeToken) {
                        hello.resume_token = this.resumeToken;
                    }
                    socket.send(JSON.stringify(hello));
                };

                socket.onmessage = (event) => {
                    try {
                        const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                        this._handleMessage(payload);
                    } catch (err) {
                        console.error('[FastAPIWsRpcClient] Invalid message', err);
                    }
                };

                this._connectResolve = resolve;
                this._connectReject = reject;

                socket.onerror = (err) => {
                    this._emit(EVENTS.ERROR, err);
                    if (!this.connected) {
                        reject(err instanceof Error ? err : new Error('WebSocket error'));
                    }
                };

                socket.onclose = (event) => {
                    this.connected = false;
                    // Pass the close code/reason — the one specific signal the browser
                    // gives for a failed/closed WS (1006 = couldn't establish/abnormal).
                    this._emit(EVENTS.DISCONNECT, { code: event && event.code, reason: event && event.reason });
                    this._handleDisconnect();
                };
            });
        }

        call(route, params = {}, timeout = 30000) {
            if (!this.connected || !this.ws) {
                return Promise.reject(new Error('WebSocket not connected'));
            }
            const requestId = uuid();
            const payload = { type: 'request', request_id: requestId, id: requestId, route, params };

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
            if (message.type === 'welcome') {
                this.connectionId = message.connection_id || this.connectionId;
                if (message.resume_token) {
                    this.resumeToken = message.resume_token;
                }
                if (message.highest_contiguous_acked_seq != null) {
                    this.lastAckedSeq = Math.max(
                        this.lastAckedSeq,
                        Number(message.highest_contiguous_acked_seq) || 0
                    );
                }
                this.connected = true;
                this._emit(EVENTS.CONNECTION);
                if (this._connectResolve) {
                    this._connectResolve();
                    this._connectResolve = null;
                    this._connectReject = null;
                }
                return;
            }
            if (message.type === 'ack_confirmation' && message.success) {
                if (message.highest_contiguous_acked_seq != null) {
                    this.lastAckedSeq = Math.max(
                        this.lastAckedSeq,
                        Number(message.highest_contiguous_acked_seq) || 0
                    );
                }
                return;
            }
            if (message.type === 'server_event') {
                const eventId = message.event_id;
                if (eventId && this._seenEventIds.has(eventId)) {
                    if (message.requires_ack) {
                        this._sendDurableAck(message);
                    }
                    return;
                }
                if (eventId) {
                    this._seenEventIds.add(eventId);
                    if (this._seenEventIds.size > 512) {
                        this._seenEventIds.clear();
                        this._seenEventIds.add(eventId);
                    }
                }
                this._emit('server_event', message);
                this._emit('event', message);
                if (message.requires_ack) {
                    this._sendDurableAck(message);
                }
                return;
            }
            const responseId = message.request_id || message.id;
            if (message.type === 'response' && responseId) {
                const entry = this.pending.get(responseId);
                if (entry) {
                    clearTimeout(entry.timer);
                    this.pending.delete(responseId);
                    if (message.error) {
                        entry.reject(new Error(message.error));
                    } else {
                        entry.resolve(message.result);
                    }
                    if (message.requires_ack) {
                        this._sendAck(responseId);
                    }
                }
            } else if (message.type === 'event') {
                this._emit('event', message);
            }
        }

        _sendDurableAck(msg) {
            if (!this.ws) return;
            this.ws.send(JSON.stringify({
                type: 'ack',
                client_id: this.clientId,
                connection_id: this.connectionId || msg.connection_id,
                event_id: msg.event_id,
                seq: msg.seq,
                id: msg.event_id,
            }));
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
