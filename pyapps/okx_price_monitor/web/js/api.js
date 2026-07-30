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
     * @returns {Promise<object>} Response data
     */
    async function call(route, params = {}) {
        const url = `${config.api.baseUrl}${config.api.rpcPath}/${route}`;
        const requestId = generateRequestId();

        if (config.debug) {
            console.log(`[API] Calling ${route}`, { params, requestId });
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Request-ID': requestId,
                },
                body: JSON.stringify(params)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (config.debug) {
                console.log(`[API] Response from ${route}`, data);
            }

            return data;

        } catch (error) {
            console.error(`[API] Error calling ${route}:`, error);
            throw error;
        }
    }

    /**
     * Generate unique request ID
     * @returns {string} Request ID
     */
    function generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
