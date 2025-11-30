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

/**
 * OKX Monitor Controller
 *
 * Provides RPC interface for OKX price monitoring functionality
 */

const logger = require('#@logger');

class OKXMonitorController {
    constructor() {
        this.monitorService = null;
    }

    /**
     * Initialize controller with monitor service
     */
    async initialize() {
        try {
            // Get monitor instance from app
            const okxApp = require('#@apps/okx_price_monitor/main.js');
            this.monitorService = okxApp.getMonitorInstance();

            if (!this.monitorService) {
                logger.warn('OKX Monitor Service not yet initialized');
            }

            return true;
        } catch (error) {
            logger.error('Failed to initialize OKX Monitor Controller:', error);
            return false;
        }
    }

    /**
     * Get latest price data
     */
    async getLatestData() {
        try {
            if (!this.monitorService) {
                await this.initialize();
            }

            if (!this.monitorService) {
                return {
                    success: false,
                    error: 'Monitor service not available. Please start the okx_price_monitor app first.'
                };
            }

            const data = this.monitorService.getLatestData();
            return {
                success: true,
                ...data
            };
        } catch (error) {
            logger.error('Failed to get latest data:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get price history
     */
    async getHistory(params = {}) {
        try {
            const limit = params.limit || 100;

            if (!this.monitorService) {
                await this.initialize();
            }

            if (!this.monitorService) {
                return {
                    success: false,
                    error: 'Monitor service not available. Please start the okx_price_monitor app first.'
                };
            }

            const history = this.monitorService.getHistory(limit);
            return {
                success: true,
                count: history.length,
                history: history
            };
        } catch (error) {
            logger.error('Failed to get history:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get monitor status
     */
    async getStatus() {
        try {
            if (!this.monitorService) {
                await this.initialize();
            }

            if (!this.monitorService) {
                return {
                    success: false,
                    error: 'Monitor service not available. Please start the okx_price_monitor app first.',
                    status: {
                        isRunning: false
                    }
                };
            }

            const status = this.monitorService.getStatus();
            return {
                success: true,
                status: status
            };
        } catch (error) {
            logger.error('Failed to get status:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Start monitoring (if not already running)
     */
    async startMonitor() {
        try {
            if (!this.monitorService) {
                return {
                    success: false,
                    error: 'Monitor service not available. Please start the okx_price_monitor app first.'
                };
            }

            await this.monitorService.start();
            return {
                success: true,
                message: 'Monitor started successfully'
            };
        } catch (error) {
            logger.error('Failed to start monitor:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Stop monitoring
     */
    async stopMonitor() {
        try {
            if (!this.monitorService) {
                return {
                    success: false,
                    error: 'Monitor service not available'
                };
            }

            await this.monitorService.stop();
            return {
                success: true,
                message: 'Monitor stopped successfully'
            };
        } catch (error) {
            logger.error('Failed to stop monitor:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Create singleton instance
const okxMonitorController = new OKXMonitorController();

module.exports = okxMonitorController;
