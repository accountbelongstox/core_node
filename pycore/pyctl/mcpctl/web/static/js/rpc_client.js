/**
 * RPC v2 Unified Client Library
 *
 * Provides a unified interface for calling MCP backend RPC endpoints.
 * Uses HTTP POST to /rpc/* endpoints with JSON payloads.
 */

class RPCClient {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
        this.requestCount = 0;
        this.pendingRequests = new Map();
    }

    /**
     * Call an RPC method
     * @param {string} method - The RPC method name (e.g., 'backend_info')
     * @param {object} params - Method parameters
     * @param {number} timeout - Request timeout in milliseconds
     * @returns {Promise<any>} The response data
     */
    async call(method, params = {}, timeout = 30000) {
        const requestId = ++this.requestCount;
        const url = `${this.baseUrl}/rpc/${method}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            this.pendingRequests.set(requestId, { method, timestamp: Date.now() });

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

            // Handle RPC v2 response format: { success: bool, result: any, error: string }
            // OR simple format: { success: bool, data: any, error: string }
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

// Export for use in other scripts
window.RPCClient = RPCClient;
