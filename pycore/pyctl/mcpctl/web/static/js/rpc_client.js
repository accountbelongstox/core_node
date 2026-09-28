/**
 * MCP Backend RPC Client (Enhanced with RPC v2 features)
 *
 * MCP-specific HTTP client with:
 * - UMD module support
 * - Retry handling
 * - Request persistence
 *
 * Preserves all MCP-specific business logic
 */

(function (global, factory) {
    // UMD module pattern.
    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define(factory);
    } else {
        global.RPCClient = factory();
    }
})(typeof window !== 'undefined' ? window : this, function () {
    'use strict';

    const isBrowser = typeof window !== 'undefined';

    // Generate a request UUID.
    function uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    class RPCClient {
        constructor(baseUrl = '', options = {}) {
            this.baseUrl = baseUrl;
            this.requestCount = 0;
            this.pendingRequests = new Map();

            // Enhanced options (从 RPC v2 复用)
            this.options = {
                retryCount: options.retryCount || 0,           // 重试次数
                retryDelay: options.retryDelay || 1000,        // 重试延迟
                timeout: options.timeout || 30000,             // 超时时间
                debug: options.debug || false,                 // 调试模式
                storageKey: options.storageKey || 'mcp_rpc_pending',  // 持久化 key
                enablePersistence: options.enablePersistence !== false  // 启用持久化
            };

            // Restore pending requests from storage (复用 RPC v2 逻辑)
            if (this.options.enablePersistence && isBrowser) {
                this._restorePendingRequests();
            }
        }

        /**
         * Call an RPC method with retry support
         * Enhanced from original with retry mechanism (from RPC v2)
         */
        async call(method, params = {}, timeout = null) {
            timeout = timeout || this.options.timeout;
            const requestId = uuid();

            let attempts = 0;
            const maxAttempts = this.options.retryCount + 1;
            let lastError = null;

            // Record pending request (增强：持久化)
            this._recordPendingRequest(requestId, method);

            while (attempts < maxAttempts) {
                try {
                    const result = await this._doCall(requestId, method, params, timeout);
                    this._removePendingRequest(requestId);
                    return result;
                } catch (error) {
                    lastError = error;
                    attempts++;

                    if (attempts < maxAttempts) {
                        if (this.options.debug) {
                            console.log(`[RPCClient] Retrying ${method} (attempt ${attempts}/${maxAttempts})`);
                        }
                        await this._delay(this.options.retryDelay * attempts);
                    }
                }
            }

            this._removePendingRequest(requestId);
            throw lastError;
        }

        /**
         * Core HTTP POST call (保留原有逻辑)
         */
        async _doCall(requestId, method, params, timeout) {
            const url = `${this.baseUrl}/rpc/${method}`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            try {
                this.pendingRequests.set(requestId, {
                    method,
                    timestamp: Date.now(),
                    params
                });

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(params),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`RPC Error (${response.status}): ${errorText}`);
                }

                const data = await response.json();

                // Handle RPC v2 response format (保留原有逻辑)
                if (data.success === false) {
                    throw new Error(data.error || 'RPC call failed');
                }

                // RPC v2 uses 'result' field, fallback to 'data' or whole object
                return data.result || data.data || data;

            } catch (error) {
                if (error.name === 'AbortError') {
                    throw new Error(`RPC timeout: ${method} (${timeout}ms)`);
                }
                throw error;
            } finally {
                this.pendingRequests.delete(requestId);
            }
        }

        /**
         * Delay utility (from RPC v2)
         */
        _delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        /**
         * Request persistence (from RPC v2)
         */
        _recordPendingRequest(id, method) {
            if (!this.options.enablePersistence || !isBrowser) return;

            try {
                const pending = this._getPendingFromStorage();
                pending[id] = { method, timestamp: Date.now() };
                localStorage.setItem(this.options.storageKey, JSON.stringify(pending));
            } catch (err) {
                if (this.options.debug) {
                    console.warn('[RPCClient] Failed to persist request:', err);
                }
            }
        }

        _removePendingRequest(id) {
            if (!this.options.enablePersistence || !isBrowser) return;

            try {
                const pending = this._getPendingFromStorage();
                delete pending[id];
                localStorage.setItem(this.options.storageKey, JSON.stringify(pending));
            } catch (err) {
                // Silent fail
            }
        }

        _restorePendingRequests() {
            if (!isBrowser) return;

            try {
                const pending = this._getPendingFromStorage();
                const count = Object.keys(pending).length;
                if (count > 0 && this.options.debug) {
                    console.log(`[RPCClient] Restored ${count} pending requests`);
                }
            } catch (err) {
                // Silent fail
            }
        }

        _getPendingFromStorage() {
            if (!isBrowser) return {};

            try {
                const raw = localStorage.getItem(this.options.storageKey);
                return raw ? JSON.parse(raw) : {};
            } catch (err) {
                return {};
            }
        }

        // ============================================================
        // MCP-specific business methods (保留所有原有业务逻辑)
        // ============================================================

        /**
         * Get backend information
         */
        async getBackendInfo() {
            return this.call('backend_info');
        }

        /**
         * Get backend state (processing state)
         */
        async getBackendState() {
            return this.call('backend_state');
        }

        /**
         * Get list of available tools
         */
        async getToolsList() {
            return this.call('tools_list');
        }

        /**
         * Health check
         */
        async healthCheck() {
            return this.call('health_check');
        }

        /**
         * Call a file processing tool
         */
        async callFileTool(toolName, params) {
            return this.call(`file/${toolName}`, params);
        }

        /**
         * Call a database tool
         */
        async callDatabaseTool(toolName, params) {
            return this.call(`database/${toolName}`, params);
        }

        /**
         * Call a codebase tool
         */
        async callCodebaseTool(toolName, params) {
            return this.call(`codebase/${toolName}`, params);
        }

        /**
         * Get number of pending requests
         */
        getPendingCount() {
            return this.pendingRequests.size;
        }

        /**
         * Get total request count
         */
        getTotalCount() {
            return this.requestCount;
        }
    }

    return RPCClient;
});
