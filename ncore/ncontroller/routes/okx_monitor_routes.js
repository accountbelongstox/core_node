'use strict';

/**
 * OKX Monitor Routes - RPC route definitions
 */

const okxMonitorController = require('../controllers/okx_monitor_controller');

module.exports = {
    /**
     * Get latest price data
     * Route: /rpc/okx/latest
     */
    latest: async (req, res) => {
        try {
            const result = await okxMonitorController.getLatestData();
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },

    /**
     * Get price history
     * Route: /rpc/okx/history
     * Query params: limit (optional, default: 100)
     */
    history: async (req, res) => {
        try {
            const params = {
                limit: parseInt(req.query.limit || req.body?.limit || 100)
            };
            const result = await okxMonitorController.getHistory(params);
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },

    /**
     * Get monitor status
     * Route: /rpc/okx/status
     */
    status: async (req, res) => {
        try {
            const result = await okxMonitorController.getStatus();
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },

    /**
     * Start the monitor
     * Route: /rpc/okx/start
     */
    start: async (req, res) => {
        try {
            const result = await okxMonitorController.startMonitor();
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },

    /**
     * Stop the monitor
     * Route: /rpc/okx/stop
     */
    stop: async (req, res) => {
        try {
            const result = await okxMonitorController.stopMonitor();
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
};
