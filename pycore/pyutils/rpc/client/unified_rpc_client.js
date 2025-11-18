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

            // ✅ Load clientId from localStorage for persistence across refreshes
            const storageKey = 'rpc_client_id';
            let clientId = options.clientId;

            if (!clientId && isBrowser) {
                // Try to restore from localStorage
                clientId = localStorage.getItem(storageKey);
            }

            if (!clientId) {
                // Generate new UUID
                clientId = generateUUID();
            }

            // Save to localStorage for persistence
            if (isBrowser) {
                localStorage.setItem(storageKey, clientId);
            }

            // ✅ Merge options but ensure clientId is not overwritten
            this.options = {
                timeout: options.timeout || 30000,
                reconnect: options.reconnect !== false,
                reconnectInterval: options.reconnectInterval || 3000,
                maxReconnectAttempts: options.maxReconnectAttempts || 10,
                httpFallback: options.httpFallback === true, // default: disable HTTP fallback unless explicitly enabled
                preferWebSocket: options.preferWebSocket !== false,
                wsPath: options.wsPath || '/rpc/ws',
                httpPath: options.httpPath || '/rpc',
                debug: options.debug || false,
                storageKey: storageKey,
                ...options,
                // ✅ Ensure clientId is set last (will not be overwritten)
                clientId: clientId
            };

            this.mode = null;
            this.ws = null;
            this.connected = false;
            this.reconnectAttempts = 0;
            this.pendingRequests = new Map();
            this.eventHandlers = new Map();
            this.reconnectTimer = null;

            // ✅ NEW: Event/Callback Registry (MCP Table)
            // All event callbacks must register here
            this.callbackRegistry = new Map();  // callbackId → callbackFunction

            // ✅ NEW: Pending requests storage key for localStorage persistence
            this.pendingRequestsStorageKey = `rpc_pending_requests_${clientId}`;
            this.callbackRegistryStorageKey = `rpc_callback_registry_${clientId}`;

            // ✅ NEW: Load pending requests and callback registry from localStorage
            this._loadPendingRequests();
            this._loadCallbackRegistry();
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
                                this._log('HTTP fallback disabled; propagating WebSocket error');
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
                const wsUrl = this.baseUrl.replace(/^http/, 'ws') + this.options.wsPath;
                this._log(`Connecting to WebSocket: ${wsUrl}`);

                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    this.connected = true;
                    this.mode = 'ws';
                    this.reconnectAttempts = 0;
                    this._log('WebSocket connected');

                    // Send client ID to server for reconnection handling
                    // Server will push pending tasks if this client has disconnected history
                    this._sendClientId();

                    this._emit(EVENTS.CONNECTION, { mode: 'websocket' });
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    this._handleWebSocketMessage(event.data);
                };

                this.ws.onerror = (error) => {
                    const errorInfo = error && error.message ? error.message : JSON.stringify(error);
                    this._log('WebSocket error event:', errorInfo);
                    this._emit(EVENTS.ERROR, error);
                    if (!this.connected) {
                        reject(new Error(`WebSocket connection error: ${errorInfo}`));
                    }
                };

                this.ws.onclose = (event) => {
                    this.connected = false;
                    const closeInfo = event ? `code=${event.code}, reason=${event.reason || 'n/a'}` : 'unknown';
                    this._log(`WebSocket disconnected (${closeInfo})`);
                    this._emit(EVENTS.DISCONNECT, { mode: 'websocket', info: closeInfo });

                    if (this.options.reconnect && this.mode === 'ws') {
                        this._attemptReconnect();
                    }
                };
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

                if (message.type === 'inventory') {
                    // Server pushed pending tasks from inventory (reconnection with history)
                    this._log('Received inventory push:', message.items?.length || 0, 'items');
                    this._emit('inventory_push', message.items || []);

                    // Send ACK for inventory push
                    if (message.requires_ack && message.id) {
                        this._sendAck(message.id);
                    }
                    return;
                }

                if (message.type === MSG_TYPES.RESPONSE) {
                    const pending = this.pendingRequests.get(message.id);
                    if (pending) {
                        this.pendingRequests.delete(message.id);
                        this._savePendingRequests();  // ✅ Update localStorage

                        // ✅ NEW: Execute callback from registry if exists
                        if (pending.callbackId) {
                            this._executeCallback(pending.callbackId, message);
                        }

                        // Execute Promise handlers (for backward compatibility)
                        if (message.success) {
                            pending.resolve && pending.resolve(message.result);
                        } else {
                            pending.reject && pending.reject(new Error(message.error || message.message || 'Request failed'));
                        }
                    }

                    // ✅ Send ACK confirmation if required
                    if (message.requires_ack && message.id) {
                        this._sendAck(message.id);
                    }
                } else if (message.type === MSG_TYPES.ERROR) {
                    const pending = this.pendingRequests.get(message.id);
                    if (pending) {
                        this.pendingRequests.delete(message.id);
                        this._savePendingRequests();  // ✅ Update localStorage

                        // ✅ NEW: Execute callback from registry if exists
                        if (pending.callbackId) {
                            this._executeCallback(pending.callbackId, message);
                        }

                        pending.reject && pending.reject(new Error(message.error || message.message || 'Unknown error'));
                    }

                    // ✅ Send ACK for error responses too
                    if (message.requires_ack && message.id) {
                        this._sendAck(message.id);
                    }
                } else if (message.type === MSG_TYPES.EVENT) {
                    this._emit(message.event || 'message', message.data);

                    // ✅ Send ACK for events if required
                    if (message.requires_ack && message.id) {
                        this._sendAck(message.id);
                    }
                } else if (message.type === MSG_TYPES.PONG) {
                    this._log('Received pong');
                }

            } catch (error) {
                this._log('Error handling WebSocket message:', error);
                this._emit(EVENTS.ERROR, error);
            }
        }

        async call(route, params = {}, options = {}) {
            /**
             * RPC Call - Event-driven async RPC implementation (NO TIMEOUT)
             *
             * Architecture:
             * - WebSocket mode: Send request → Register callback → Wait indefinitely for server push → Execute callback
             * - HTTP mode: ONLY when WebSocket unavailable
             * - Event ID system: Both client and server store eventId for correlation
             * - Callback storage: pendingRequests Map stores eventId → {resolve, reject, callbackId}
             * - NO TIMEOUT: Suitable for long-running tasks (hours)
             * - WebSocket: Wait for push indefinitely
             * - HTTP: Poll every 1 second indefinitely until 'completed' or 'failed'
             *
             * ✅ NEW: WebSocket-first strategy
             * - If WebSocket is available, ALWAYS use WebSocket (no HTTP fallback)
             * - HTTP is ONLY used when WebSocket is completely unavailable
             * - Pending requests are persisted to localStorage for page refresh recovery
             *
             * ✅ NEW: Event/Callback Registry (MCP Table)
             * - options.callbackId: Optional callback ID to execute when response arrives
             * - Callbacks registered via registerCallback(callbackId, callbackFunction)
             * - Data passed immediately to callback (NOT stored in localStorage)
             * - Only requestId + callbackId stored in localStorage
             */
            const requestId = generateUUID();
            const timeout = options.timeout || this.options.timeout; // Kept for backward compatibility but not used
            const callbackId = options.callbackId || null; // ✅ NEW: Optional callback ID

            return new Promise((resolve, reject) => {
                // ✅ Strict WebSocket-first: Use WebSocket if available
                const hasWebSocket = this.mode === 'ws' && this.connected && this.ws && this.ws.readyState === WebSocket.OPEN;

                // ✅ NEW: Reject HTTP if WebSocket is available (strict mode)
                if (hasWebSocket) {
                    this._callWebSocket(requestId, route, params, timeout, resolve, reject, callbackId);
                } else if (this.options.forceWebSocket) {
                    // ✅ NEW: If forceWebSocket=true, reject when WebSocket is unavailable
                    reject(new Error('WebSocket required but not connected. Please wait for connection or disable forceWebSocket option.'));
                } else {
                    // Fall back to HTTP only when WebSocket is unavailable
                    this._callHttp(requestId, route, params, timeout, resolve, reject);
                }
            });
        }

        _callWebSocket(requestId, route, params, timeout, resolve, reject, callbackId = null) {
            // ✅ No timeout - wait indefinitely for server push
            // For long-running tasks (hours), rely on event-driven architecture

            // ✅ NEW: Store only callbackId (NOT route/params - data passed immediately to callbacks)
            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                callbackId: callbackId,  // ✅ Only store callback ID
                timestamp: Date.now()    // ✅ Track when request was made
            });

            // ✅ NEW: Save to localStorage (only requestId + callbackId)
            this._savePendingRequests();

            const message = {
                type: MSG_TYPES.REQUEST,
                id: requestId,
                route: route,
                params: params
            };

            try {
                this.ws.send(JSON.stringify(message));
                this._log(`Request sent: ${route} (id: ${requestId.substring(0, 8)}...)`);
            } catch (error) {
                this.pendingRequests.delete(requestId);
                this._savePendingRequests();  // ✅ Update storage
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

            // ✅ No timeout - HTTP polling will continue indefinitely until result is ready
            this._httpPost(url, requestData)
                .then((response) => {
                    // Handle async response format: { status: 'accepted', id: '...' }
                    if (response.status === 'accepted' && response.id) {
                        this._log('Request accepted, polling for result...');
                        // Poll for result indefinitely
                        this._pollForResult(response.id, resolve, reject);
                    } else if (response.success !== undefined) {
                        // Standard response format: { success: true, result: ... }
                        if (response.success) {
                            resolve(response.result || response.data || response);
                        } else {
                            reject(new Error(response.error || response.message || 'Request failed'));
                        }
                    } else if (response.result !== undefined) {
                        // Direct result format
                        resolve(response.result);
                    } else {
                        // Unknown format, return as-is
                        resolve(response);
                    }
                })
                .catch((error) => {
                    reject(error);
                });
        }

        _pollForResult(requestId, resolve, reject) {
            /**
             * ✅ Infinite HTTP polling - no timeout
             *
             * For long-running tasks (hours), this will poll every 1 second indefinitely
             * until the server returns 'completed' or 'failed' status.
             *
             * Architecture:
             * - Poll interval: 1 second
             * - No timeout limit - suitable for long tasks
             * - Network errors: auto-retry
             */
            const pollUrl = `${this.baseUrl}${this.options.httpPath}/query/${requestId}`;
            const pollInterval = 1000; // Poll every 1 second

            const poll = () => {
                this._httpGet(pollUrl)
                    .then((response) => {
                        this._log('Poll response:', response);

                        // Check if result is ready
                        if (response.status === 'completed' || response.result !== undefined) {
                            if (response.error) {
                                reject(new Error(response.error));
                            } else {
                                resolve(response.result || response.data || response);
                            }
                        } else if (response.status === 'failed') {
                            reject(new Error(response.error || 'Request failed'));
                        } else if (response.status === 'processing' || response.status === 'pending') {
                            // Still processing, poll again after 1 second
                            setTimeout(poll, pollInterval);
                        } else {
                            // Unknown status, try to extract result
                            if (response.success === false) {
                                reject(new Error(response.error || response.message || 'Request failed'));
                            } else {
                                resolve(response.result || response.data || response);
                            }
                        }
                    })
                    .catch((error) => {
                        this._log('Poll error (will retry):', error);
                        // Auto-retry on network error after 1 second
                        setTimeout(poll, pollInterval);
                    });
            };

            // Start polling after 1 second delay
            setTimeout(poll, pollInterval);
        }

        _httpGet(url) {
            if (isBrowser) {
                return fetch(url)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                        return response.json();
                    });
            } else {
                return this._nodeHttpRequest(url, 'GET');
            }
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

        _sendClientId() {
            /**
             * Send client ID to server after WebSocket connection
             *
             * Server will check if this client has pending tasks (inventory)
             * and push them if reconnecting with history.
             */
            if (this.mode === 'ws' && this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                try {
                    this.ws.send(JSON.stringify({
                        type: 'client_id',
                        client_id: this.options.clientId
                    }));
                    this._log('Sent client ID to server:', this.options.clientId);
                } catch (error) {
                    this._log('Failed to send client ID:', error);
                }
            }
        }

        _sendAck(requestId) {
            /**
             * Send ACK confirmation for received message
             *
             * Development Guidelines:
             * - Send ACK message after receiving response/event with requires_ack flag
             * - Uses fixed protocol format: { type: 'ack', id: requestId }
             * - Only for WebSocket connections
             */
            if (this.mode === 'ws' && this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                try {
                    this.ws.send(JSON.stringify({
                        type: 'ack',
                        id: requestId
                    }));
                    this._log('Sent ACK for request:', requestId);
                } catch (error) {
                    this._log('Failed to send ACK:', error);
                }
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

            // Reject all pending requests
            this.pendingRequests.forEach(({ reject }) => {
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

        /**
         * ✅ NEW: Save pending requests to localStorage
         * Stores ONLY requestId + callbackId (NOT route, params, or return values)
         * Data is passed immediately to callbacks (not stored)
         */
        _savePendingRequests() {
            if (!isBrowser) return;

            try {
                const pendingData = [];
                this.pendingRequests.forEach((value, requestId) => {
                    // ✅ Store ONLY requestId + callbackId
                    // NO route, NO params, NO return values
                    pendingData.push({
                        id: requestId,
                        callbackId: value.callbackId || null,
                        timestamp: value.timestamp || Date.now()
                    });
                });

                localStorage.setItem(this.pendingRequestsStorageKey, JSON.stringify(pendingData));
                this._log(`Saved ${pendingData.length} pending requests to localStorage`);
            } catch (error) {
                this._log('Error saving pending requests:', error);
            }
        }

        /**
         * ✅ NEW: Load pending requests from localStorage
         * Restores ONLY requestId + callbackId (NOT route/params)
         */
        _loadPendingRequests() {
            if (!isBrowser) return;

            try {
                const stored = localStorage.getItem(this.pendingRequestsStorageKey);
                if (!stored) return;

                const pendingData = JSON.parse(stored);
                this._log(`Loaded ${pendingData.length} pending requests from localStorage`);

                // Note: Callbacks are NOT restored - user must re-register callbacks
                // This data is for tracking pending request IDs only
                this.storedPendingRequests = pendingData;
            } catch (error) {
                this._log('Error loading pending requests:', error);
                this.storedPendingRequests = [];
            }
        }

        /**
         * ✅ NEW: Clear pending requests from localStorage
         */
        _clearPendingRequests() {
            if (!isBrowser) return;

            try {
                localStorage.removeItem(this.pendingRequestsStorageKey);
                this._log('Cleared pending requests from localStorage');
            } catch (error) {
                this._log('Error clearing pending requests:', error);
            }
        }

        /**
         * ✅ NEW: Register callback in Event/Callback Registry (MCP Table)
         * All event callbacks must register here before use
         *
         * @param {string} callbackId - Unique callback identifier
         * @param {Function} callbackFunction - Callback function(message) to execute
         *
         * Example:
         *   client.registerCallback('ui_update', (message) => {
         *       console.log('Updating UI with:', message.result);
         *       updateUI(message.result);
         *   });
         */
        registerCallback(callbackId, callbackFunction) {
            if (!callbackId || typeof callbackId !== 'string') {
                throw new Error('callbackId must be a non-empty string');
            }
            if (typeof callbackFunction !== 'function') {
                throw new Error('callbackFunction must be a function');
            }

            this.callbackRegistry.set(callbackId, callbackFunction);
            this._saveCallbackRegistry();
            this._log(`Registered callback: ${callbackId}`);
        }

        /**
         * ✅ NEW: Unregister callback from Event/Callback Registry
         *
         * @param {string} callbackId - Callback identifier to remove
         */
        unregisterCallback(callbackId) {
            const removed = this.callbackRegistry.delete(callbackId);
            if (removed) {
                this._saveCallbackRegistry();
                this._log(`Unregistered callback: ${callbackId}`);
            }
            return removed;
        }

        /**
         * ✅ NEW: Execute callback from registry or use default handler
         * Called when WebSocket message arrives with a callbackId
         *
         * @param {string} callbackId - Callback identifier
         * @param {Object} message - WebSocket message containing result/error
         */
        _executeCallback(callbackId, message) {
            if (!callbackId) return;

            const callback = this.callbackRegistry.get(callbackId);
            if (callback) {
                try {
                    // ✅ Execute registered callback with message data
                    // Data is passed immediately (NOT stored in localStorage)
                    callback(message);
                } catch (error) {
                    console.error(`[UnifiedRpcClient] Error executing callback ${callbackId}:`, error);
                }
            } else {
                // ✅ Use default callback handler when no custom handler registered
                this._defaultCallback(callbackId, message);
            }
        }

        /**
         * ✅ NEW: Default callback handler
         * Called when no custom callback is registered for a callbackId
         *
         * Prints received data and shows how to register custom handlers
         */
        _defaultCallback(callbackId, message) {
            console.log('\n═══════════════════════════════════════════════════');
            console.log('[UnifiedRpcClient] Default Callback Handler');
            console.log('═══════════════════════════════════════════════════');
            console.log(`Callback ID: ${callbackId}`);
            console.log('Status:', message.success ? 'SUCCESS' : 'FAILED');
            console.log('\nReceived Data:');
            console.log(JSON.stringify(message, null, 2));
            console.log('\n⚠️  No custom handler registered for this callback ID');
            console.log('\n📝 To register a custom handler, use:');
            console.log(`\n   client.registerCallback('${callbackId}', (message) => {`);
            console.log('       // Your custom handler code here');
            console.log('       console.log("Processing result:", message.result);');
            console.log('       // Example: Update UI, save to database, etc.');
            console.log('   });');
            console.log('\n═══════════════════════════════════════════════════\n');
        }

        /**
         * ✅ NEW: Save callback registry to localStorage
         * Stores ONLY callback IDs (NOT functions - those must be re-registered)
         */
        _saveCallbackRegistry() {
            if (!isBrowser) return;

            try {
                const callbackIds = Array.from(this.callbackRegistry.keys());
                localStorage.setItem(this.callbackRegistryStorageKey, JSON.stringify(callbackIds));
                this._log(`Saved ${callbackIds.length} callback IDs to localStorage`);
            } catch (error) {
                this._log('Error saving callback registry:', error);
            }
        }

        /**
         * ✅ NEW: Load callback registry from localStorage
         * Restores ONLY callback IDs (functions must be re-registered)
         */
        _loadCallbackRegistry() {
            if (!isBrowser) return;

            try {
                const stored = localStorage.getItem(this.callbackRegistryStorageKey);
                if (!stored) return;

                const callbackIds = JSON.parse(stored);
                this._log(`Loaded ${callbackIds.length} callback IDs from localStorage`);

                // Note: Callback functions are NOT restored - user must re-register
                // This data is for informational purposes only
                this.storedCallbackIds = callbackIds;

                if (callbackIds.length > 0) {
                    console.warn(
                        `[UnifiedRpcClient] Found ${callbackIds.length} callback IDs from previous session.\n` +
                        'Callback functions need to be re-registered:\n' +
                        callbackIds.map(id => `  - ${id}`).join('\n')
                    );
                }
            } catch (error) {
                this._log('Error loading callback registry:', error);
                this.storedCallbackIds = [];
            }
        }

        _log(...args) {
            if (this.options.debug) {
                console.log('[UnifiedRpcClient]', ...args);
            }
        }
    }

    return UnifiedRpcClient;
});

