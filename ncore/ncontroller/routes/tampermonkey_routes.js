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
 * Tampermonkey Routes - RPC route definitions for DocumentOffline Crawler
 */

const tampermonkeyController = require('../controllers/tampermonkey_controller');

module.exports = {
    /**
     * Get service status
     * Route: /rpc/tampermonkey/status
     */
    status: async (req, res) => {
        try {
            const result = await tampermonkeyController.getStatus();
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },

    /**
     * Ping endpoint
     * Route: /rpc/tampermonkey/ping
     */
    ping: async (req, res) => {
        try {
            const result = await tampermonkeyController.ping();
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },

    /**
     * Upload page data
     * Route: /rpc/tampermonkey/page
     * Body: page data object
     */
    page: async (req, res) => {
        try {
            const pageData = req.body;
            const result = await tampermonkeyController.handlePageUpload(pageData);
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },

    /**
     * Submit completion notification
     * Route: /rpc/tampermonkey/complete
     * Body: completion data object
     */
    complete: async (req, res) => {
        try {
            const completeData = req.body;
            const result = await tampermonkeyController.handleComplete(completeData);
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },

    /**
     * Send command to connected clients
     * Route: /rpc/tampermonkey/command
     * Body: { action: string, payload: object }
     */
    command: async (req, res) => {
        try {
            const { action, payload } = req.body || {};
            const result = await tampermonkeyController.sendCommand(action, payload);
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },

    /**
     * Broadcast config to connected clients
     * Route: /rpc/tampermonkey/config
     * Body: config object
     */
    config: async (req, res) => {
        try {
            const config = req.body || {};
            const result = await tampermonkeyController.broadcastConfig(config);
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },

    /**
     * Get received pages
     * Route: /rpc/tampermonkey/pages
     */
    pages: async (req, res) => {
        try {
            const result = await tampermonkeyController.getReceivedPages();
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },

    /**
     * Clear received pages
     * Route: /rpc/tampermonkey/clear
     */
    clear: async (req, res) => {
        try {
            const result = await tampermonkeyController.clearReceivedPages();
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
};
