// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

'use strict';

const logger = require('#@logger');
const globalDir = require('#@global_dir');
const fwriter = require('#@fwriter');
const axios = require('axios');

/**
 * OKX Monitor Service
 * Opens base page and injects API requests for price data
 */
class OKXMonitorService {
    constructor(config) {
        this.config = config;
        this.rpcBaseUrl = config.rpcBaseUrl || 'http://127.0.0.1:58000';
        this.basePageUrl = config.basePageUrl; // Base page URL
        this.apiUrlTemplate = config.apiUrlTemplate; // API URL template
        this.currencies = config.currencies || []; // List of currencies
        this.fetchInterval = config.fetchInterval;
        this.isRunning = false;
        this.intervalId = null;
        this.pageId = null;
        this.priceHistory = [];
        this.lastFetchTime = null;
        this.lastFetchData = null;
        this.isInitialized = false;
    }

    /**
     * Call RPC endpoint
     */
    async callRPC(route, params = {}) {
        try {
            const url = `${this.rpcBaseUrl}/rpc/${route}`;
            const response = await axios.post(url, params, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            });
            const data = response.data;
            // RPC response format: { success: true, result: {...} }
            // Extract the actual result
            if (data.success && data.result) {
                return data.result;
            }
            return data;
        } catch (error) {
            logger.error(`RPC call failed for ${route}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Initialize the monitor service
     */
    async initialize() {
        try {
            logger.info('Initializing OKX Monitor Service...');
            logger.info(`Base Page URL: ${this.basePageUrl}`);

            // Open the base OKX page via RPC with smart tab reuse
            const openResult = await this.callRPC('browser/openUrl', {
                url: this.basePageUrl,
                matchMode: 'sameOrigin', // Reuse tabs with same hostname
                waitUntil: 'networkidle2',
                timeout: 30000,
                screenshot: false,
                htmlContent: false
            });

            if (!openResult.success) {
                logger.error('Failed to open base page:', openResult.error);
                return false;
            }

            this.pageId = openResult.pageId;
            logger.info(`Base page opened successfully, pageId: ${this.pageId}`);
            logger.info(`Tab action: ${openResult.tabAction}`); // 'switched', 'reused', or 'created'

            // Wait for page to fully load
            await this.sleep(3000);

            this.isInitialized = true;
            return true;
        } catch (error) {
            logger.error('Failed to initialize OKX Monitor Service:', error);
            return false;
        }
    }

    /**
     * Start monitoring
     */
    async start() {
        if (this.isRunning) {
            logger.warn('Monitor is already running');
            return;
        }

        if (!this.isInitialized) {
            const initialized = await this.initialize();
            if (!initialized) {
                logger.error('Failed to initialize monitor, cannot start');
                return;
            }
        }

        this.isRunning = true;
        logger.info(`Starting OKX price monitoring (interval: ${this.fetchInterval}ms)`);

        // Start periodic fetching
        this.intervalId = setInterval(async () => {
            await this.fetchPriceData();
        }, this.fetchInterval);

        // Fetch immediately
        await this.fetchPriceData();
    }

    /**
     * Stop monitoring
     */
    async stop() {
        if (!this.isRunning) {
            logger.warn('Monitor is not running');
            return;
        }

        this.isRunning = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        // Close the page
        if (this.pageId) {
            await this.callRPC('page/close', { pageId: this.pageId });
            this.pageId = null;
        }

        this.isInitialized = false;
        logger.info('OKX price monitoring stopped');
    }

    /**
     * Build API URL with dynamic parameters
     */
    buildApiUrl() {
        const currenciesParam = this.currencies.join('%2C');
        const timestamp = Date.now();
        const period = '24H';

        // Construct API URL
        return `${this.apiUrlTemplate}?currencies=${currenciesParam}&period=${period}&t=${timestamp}`;
    }

    /**
     * Fetch price data by injecting API request
     */
    async fetchPriceData() {
        try {
            if (!this.pageId) {
                logger.error('Page not initialized');
                return { success: false, error: 'Page not initialized' };
            }

            const apiUrl = this.buildApiUrl();
            logger.info(`Fetching price data via injected request: ${apiUrl}`);

            // Inject API request into page context
            const apiResult = await this.callRPC('browser/injectAPIRequest', {
                pageId: this.pageId,
                apiUrl: apiUrl,
                method: 'GET',
                responseType: 'json',
                timeout: 30000
            });

            if (!apiResult.success) {
                logger.error('Failed to fetch API data:', apiResult.error);
                return { success: false, error: apiResult.error };
            }

            const priceData = apiResult.data;
            const fetchTime = new Date().toISOString();
            this.lastFetchTime = fetchTime;
            this.lastFetchData = priceData;

            // Add to history
            this.priceHistory.push({
                timestamp: fetchTime,
                data: priceData
            });

            // Limit history size
            if (this.priceHistory.length > this.config.storage.maxHistoryRecords) {
                this.priceHistory.shift();
            }

            logger.success(`Fetched price data at ${fetchTime}`);
            logger.info(`Data sample: ${JSON.stringify(priceData).substring(0, 200)}...`);

            // Save to file if configured
            if (this.config.storage.saveToFile) {
                await this.savePriceData(fetchTime, priceData);
            }

            return {
                success: true,
                timestamp: fetchTime,
                data: priceData
            };

        } catch (error) {
            logger.error('Failed to fetch price data:', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Save price data to file
     */
    async savePriceData(timestamp, data) {
        try {
            const appDir = globalDir.getAppPublicDir('okx_price_monitor');
            const fileName = `price_data_${timestamp.replace(/[:.]/g, '-')}.json`;
            const filePath = `${appDir}/${fileName}`;

            await fwriter.writeFileAsync(filePath, JSON.stringify({
                timestamp: timestamp,
                data: data
            }, null, 2));

            logger.info(`Price data saved to ${filePath}`);
        } catch (error) {
            logger.error('Failed to save price data:', error);
        }
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get the latest fetch result
     */
    getLatestData() {
        return {
            timestamp: this.lastFetchTime,
            data: this.lastFetchData,
            isRunning: this.isRunning
        };
    }

    /**
     * Get price history
     */
    getHistory(limit = 100) {
        const historyLimit = Math.min(limit, this.priceHistory.length);
        return this.priceHistory.slice(-historyLimit);
    }

    /**
     * Get monitor status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            isInitialized: this.isInitialized,
            basePageUrl: this.basePageUrl,
            apiUrlTemplate: this.apiUrlTemplate,
            fetchInterval: this.fetchInterval,
            rpcBaseUrl: this.rpcBaseUrl,
            pageId: this.pageId,
            lastFetchTime: this.lastFetchTime,
            historyCount: this.priceHistory.length,
            currencies: this.currencies
        };
    }
}

module.exports = OKXMonitorService;
