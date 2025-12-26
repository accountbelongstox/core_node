/**
 * FastAPI HTTP RPC Client
 *
 * HTTP-only helper for talking to the FastAPI RPC v2 server.
 * Usage:
 *   const client = new FastAPIHttpRpcClient('http://127.0.0.1:59000');
 *   const result = await client.call('queue_stats', {});
 */

(function (global, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define(factory);
    } else {
        global.FastAPIHttpRpcClient = factory();
    }
})(typeof window !== 'undefined' ? window : this, function () {
    'use strict';

    const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

    let http = null;
    let https = null;
    if (isNode) {
        try {
            http = require('http');
            https = require('https');
        } catch (err) {
            console.warn('FastAPIHttpRpcClient: http/https modules missing', err);
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

    class FastAPIHttpRpcClient {
        constructor(baseUrl, options = {}) {
            if (!baseUrl) {
                throw new Error('baseUrl is required');
            }
            this.baseUrl = baseUrl.replace(/\/$/, '');
            this.storageKey = options.storageKey || 'fastapi_http_rpc';
            this.pendingRequests = new Map();
            this.options = {
                httpPath: options.httpPath || '/rpc',
                retryCount: options.retryCount || 0,
                retryDelay: options.retryDelay || 1000,
                headers: options.headers || {},
                debug: !!options.debug,
                pollInterval: options.pollInterval || 1000,
                pendingStorageKey: options.pendingStorageKey || 'fastapi_http_pending',
            };
            this._restorePendingRequests();
        }

        async call(route, params = {}) {
            const payload = {
                id: uuid(),
                route,
                params,
            };
            let attempts = 0;
            const maxAttempts = this.options.retryCount + 1;
            let lastError = null;

            this._recordPendingMetadata(payload.id, route);

            while (attempts < maxAttempts) {
                try {
                    const response = await this._post(payload);
                    return this._resolveHttpResponse(payload.id, route, response);
                } catch (err) {
                    lastError = err;
                    attempts += 1;
                    if (attempts < maxAttempts) {
                        await this._delay(this.options.retryDelay * attempts);
                    }
                }
            }

            throw lastError;
        }

        async _resolveHttpResponse(requestId, route, response) {
            if (response && response.status && response.status !== 'completed') {
                return this._pollResult(requestId, route);
            }
            if (response && (response.success || response.result)) {
                this._removePendingMetadata(requestId);
                return response.result;
            }
            if (response && response.error) {
                this._removePendingMetadata(requestId);
                throw new Error(response.error);
            }
            this._removePendingMetadata(requestId);
            return response;
        }

        async _pollResult(requestId, route) {
            await this._delay(this.options.pollInterval);
            const result = await this._queryRequest(requestId);
            if (result.status === 'completed' || result.success === true) {
                this._removePendingMetadata(requestId);
                return result.result;
            }
            if (result.status === 'failed') {
                this._removePendingMetadata(requestId);
                throw new Error(result.error || 'RPC call failed');
            }
            return this._pollResult(requestId, route);
        }

        _delay(ms) {
            return new Promise((resolve) => setTimeout(resolve, ms));
        }

        _post(message) {
            const url = `${this.baseUrl}${this.options.httpPath}/${message.route}`;
            if (isBrowser) {
                return this._browserFetch(url, message);
            }
            return this._nodeRequest(url, message);
        }

        _browserFetch(url, message) {
            return fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.options.headers,
                },
                body: JSON.stringify(message),
            })
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    return response.json();
                });
        }

        _nodeRequest(url, message, method = 'POST') {
            return new Promise((resolve, reject) => {
                try {
                    const urlObj = new URL(url);
                    const lib = urlObj.protocol === 'https:' ? https : http;
                    const body = JSON.stringify(message);

                    const headers = {
                        ...this.options.headers,
                    };
                    if (method === 'POST') {
                        headers['Content-Type'] = 'application/json';
                        headers['Content-Length'] = Buffer.byteLength(body);
                    }

                    const options = {
                        hostname: urlObj.hostname,
                        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                        path: urlObj.pathname + urlObj.search,
                        method,
                        headers,
                    };

                    const req = lib.request(options, (res) => {
                        let responseBody = '';
                        res.on('data', (chunk) => (responseBody += chunk));
                        res.on('end', () => {
                            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                                try {
                                    resolve(JSON.parse(responseBody));
                                } catch (err) {
                                    reject(new Error(`Invalid JSON response: ${err.message}`));
                                }
                            } else {
                                reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage || 'Request failed'}`));
                            }
                        });
                    });

                    req.on('error', reject);
                    if (method === 'POST') {
                        req.write(body);
                    }
                    req.end();
                } catch (err) {
                    reject(err);
                }
            });
        }

        _queryRequest(requestId) {
            const url = `${this.baseUrl}${this.options.httpPath}/query/${requestId}`;
            if (isBrowser) {
                return fetch(url, {
                    method: 'GET',
                    headers: this.options.headers,
                }).then((res) => {
                    if (!res.ok) {
                        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                    }
                    return res.json();
                });
            }
            return this._nodeRequest(url, {}, 'GET');
        }

        _recordPendingMetadata(requestId, route) {
            this.pendingRequests.set(requestId, {
                id: requestId,
                route,
                createdAt: Date.now(),
            });
            this._persistPendingMetadata();
        }

        _removePendingMetadata(requestId) {
            if (this.pendingRequests.delete(requestId)) {
                this._persistPendingMetadata();
            }
        }

        _persistPendingMetadata() {
            if (!isBrowser || !window.localStorage) {
                return;
            }
            try {
                const list = Array.from(this.pendingRequests.values());
                localStorage.setItem(this.options.pendingStorageKey, encodeJSON(list));
            } catch (err) {
                console.warn('[FastAPIHttpRpcClient] Failed to persist pending metadata', err);
            }
        }

        _restorePendingRequests() {
            if (!isBrowser || !window.localStorage) {
                return;
            }
            try {
                const raw = localStorage.getItem(this.options.pendingStorageKey);
                if (!raw) {
                    return;
                }
                const entries = decodeJSON(raw);
                if (Array.isArray(entries)) {
                    entries.forEach((entry) => {
                        if (entry && entry.id && !this.pendingRequests.has(entry.id)) {
                            this.pendingRequests.set(entry.id, entry);
                            this._pollResult(entry.id, entry.route || 'restored').catch((err) => {
                                console.error('[FastAPIHttpRpcClient] Restored polling error', err);
                            });
                        }
                    });
                }
            } catch (err) {
                console.warn('[FastAPIHttpRpcClient] Failed to restore pending requests', err);
            }
        }
    }

    return FastAPIHttpRpcClient;
});
