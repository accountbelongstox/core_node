/**
 * HTTP RPC Client - Frontend JavaScript Library
 * 
 * HTTP-only client for communicating with UnifiedRpcServer.
 * 
 * Usage:
 *   const client = new HttpRpcClient('http://localhost:8080');
 *   const result = await client.call('echo', { message: 'Hello' });
 */

(function (global, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define(factory);
    } else {
        global.HttpRpcClient = factory();
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
        } catch (e) {
            console.warn('HttpRpcClient: Dependencies not available', e);
        }
    }

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

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

    class HttpRpcClient {
        constructor(baseUrl, options = {}) {
            this.baseUrl = baseUrl.replace(/\/$/, '');
            this.options = {
                httpPath: options.httpPath || '/rpc',
                timeout: options.timeout || 30000,
                retryCount: options.retryCount || 0,
                retryDelay: options.retryDelay || 1000,
                headers: options.headers || {},
                debug: options.debug || false,
                ...options
            };
        }

        async call(route, params = {}) {
            const requestId = generateUUID();
            const message = {
                id: requestId,
                route: route,
                params: params
            };

            let lastError = null;
            let attempt = 0;
            const maxAttempts = this.options.retryCount + 1;

            while (attempt < maxAttempts) {
                try {
                    const response = await this._makeRequest(message);
                    return response;
                } catch (error) {
                    lastError = error;
                    attempt++;

                    if (attempt < maxAttempts) {
                        this._log(`HTTP RPC call failed (attempt ${attempt}/${maxAttempts}), retrying...`);
                        await this._delay(this.options.retryDelay * attempt);
                    }
                }
            }

            throw lastError;
        }

        async _makeRequest(message) {
            const url = `${this.baseUrl}${this.options.httpPath}/${message.route}`;
            const controller = isBrowser && typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timeoutId = controller ? setTimeout(() => controller.abort(), this.options.timeout) : null;

            try {
                const response = await this._httpPost(url, message, controller);
                
                if (timeoutId) clearTimeout(timeoutId);

                if (response.success) {
                    return response.result;
                } else {
                    throw new Error(response.error || response.message || 'Request failed');
                }
            } catch (error) {
                if (timeoutId) clearTimeout(timeoutId);

                if (error.name === 'AbortError') {
                    throw new Error(`Request timeout after ${this.options.timeout}ms`);
                }

                throw error;
            }
        }

        _httpPost(url, data, controller = null) {
            if (isBrowser) {
                return fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...this.options.headers
                    },
                    body: JSON.stringify(data),
                    signal: controller ? controller.signal : undefined
                })
                .then(response => {
                    if (!response.ok) {
                        if (response.status === 404) {
                            throw new Error(`Route not found: ${data.route}`);
                        }
                        if (response.status === 401) {
                            throw new Error('Authentication required');
                        }
                        if (response.status === 429) {
                            throw new Error('Rate limit exceeded');
                        }
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
                            'Content-Length': Buffer.byteLength(JSON.stringify(data)),
                            ...this.options.headers
                        } : this.options.headers
                    };

                    const req = lib.request(options, (res) => {
                        let body = '';
                        res.on('data', chunk => body += chunk);
                        res.on('end', () => {
                            try {
                                if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage || 'Request failed'}`));
                                    return;
                                }
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

                    req.setTimeout(this.options.timeout, () => {
                        req.destroy();
                        reject(new Error(`Request timeout after ${this.options.timeout}ms`));
                    });

                    req.end();
                } catch (error) {
                    reject(error);
                }
            });
        }

        async batch(calls) {
            const promises = calls.map(({ route, params }) => this.call(route, params));
            return Promise.all(promises);
        }

        async batchSettled(calls) {
            const promises = calls.map(({ route, params }) =>
                this.call(route, params)
                    .then(result => ({ status: 'fulfilled', value: result }))
                    .catch(error => ({ status: 'rejected', reason: error.message }))
            );
            return Promise.all(promises);
        }

        setHeader(key, value) {
            this.options.headers[key] = value;
            return this;
        }

        removeHeader(key) {
            delete this.options.headers[key];
            return this;
        }

        setTimeout(timeout) {
            this.options.timeout = timeout;
            return this;
        }

        setRetry(count, delay = 1000) {
            this.options.retryCount = count;
            this.options.retryDelay = delay;
            return this;
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

        _delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        _log(...args) {
            if (this.options.debug) {
                console.log('[HttpRpcClient]', ...args);
            }
        }
    }

    return HttpRpcClient;
});

