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
