/**
 * API Module - RPC v2 Client
 * Handles all API communication with the backend
 */

window.API = (function() {
    'use strict';

    const config = window.AppConfig;

    /**
     * Make RPC call to backend
     * @param {string} route - RPC route name
     * @param {object} params - Request parameters
     * @param {object} options - Additional options
     * @returns {Promise<object>} Response data
     */
    async function call(route, params = {}, options = {}) {
        const url = `${config.api.baseUrl}${config.api.rpcPath}/${route}`;
        const requestId = generateRequestId();

        const requestBody = {
            route: route,
            params: params,
            id: requestId
        };

        if (config.debug) {
            console.log(`[API] Calling ${route}`, { params, requestId });
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (config.debug) {
                console.log(`[API] Response from ${route}`, data);
            }

            // Handle sync response (rpc_v2 synchronous routes)
            if (data.sync_response || data.result !== undefined) {
                return data.result || data;
            }

            // Handle async response (requires polling)
            if (data.requires_ack && data.id) {
                return await pollResult(data.id, options.timeout || config.api.timeout);
            }

            return data;

        } catch (error) {
            console.error(`[API] Error calling ${route}:`, error);
            throw error;
        }
    }

    /**
     * Poll for async request result
     * @param {string} requestId - Request ID to poll
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<object>} Result data
     */
    async function pollResult(requestId, timeout = 30000) {
        const url = `${config.api.baseUrl}${config.api.rpcPath}/query/${requestId}`;
        const startTime = Date.now();
        const pollInterval = 500; // Poll every 500ms

        if (config.debug) {
            console.log(`[API] Polling result for request ${requestId}`);
        }

        while (Date.now() - startTime < timeout) {
            try {
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();

                // Check if result is ready
                if (data.success !== undefined) {
                    if (config.debug) {
                        console.log(`[API] Got result for ${requestId}`, data);
                    }
                    return data.result || data;
                }

                if (data.status === 'completed' || data.result !== undefined) {
                    if (config.debug) {
                        console.log(`[API] Got result for ${requestId}`, data);
                    }
                    return data.result || data;
                }

                // Wait before next poll
                await sleep(pollInterval);

            } catch (error) {
                console.warn(`[API] Poll error for ${requestId}:`, error);
                await sleep(pollInterval);
            }
        }

        throw new Error(`Timeout waiting for result (request ${requestId})`);
    }

    /**
     * Generate unique request ID
     * @returns {string} Request ID
     */
    function generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Sleep utility
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get coins statistics
     * @returns {Promise<object>} Stats data
     */
    async function getCoinsStats() {
        return await call(config.routes.coinsStats);
    }

    /**
     * Get all coin summaries
     * @returns {Promise<Array>} Summaries array
     */
    async function getCoinsSummaries() {
        return await call(config.routes.coinsSummaries);
    }

    /**
     * Get specific coin summary
     * @param {string} coinSymbol - Coin symbol
     * @returns {Promise<object>} Coin summary
     */
    async function getCoinSummary(coinSymbol) {
        return await call(config.routes.coinSummary, { coin_symbol: coinSymbol });
    }

    /**
     * Get price changes for all coins
     * @returns {Promise<object>} Price changes
     */
    async function getPriceChanges() {
        return await call(config.routes.priceChanges);
    }

    /**
     * Get server status
     * @returns {Promise<object>} Server status
     */
    async function getServerStatus() {
        return await call(config.routes.serverStatus);
    }

    // Public API
    return {
        call,
        getCoinsStats,
        getCoinsSummaries,
        getCoinSummary,
        getPriceChanges,
        getServerStatus
    };
})();
