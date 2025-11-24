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
 * Tampermonkey Controller
 *
 * Provides HTTP and WebSocket interface for DocumentOffline Crawler
 */

const logger = require('#@logger');
const TampermonkeyService = require('#@ncore/utils/puppeteer_spider_v2/src/utils/tampermonkey/TampermonkeyService.js');

class TampermonkeyController {
    constructor() {
        this.service = TampermonkeyService.getInstance();
    }

    /**
     * Get service status
     */
    async getStatus() {
        try {
            return this.service.getStatus();
        } catch (error) {
            logger.error('Failed to get tampermonkey status:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Ping endpoint
     */
    async ping() {
        try {
            return this.service.getPing();
        } catch (error) {
            logger.error('Failed to ping tampermonkey service:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Handle page upload
     */
    async handlePageUpload(pageData) {
        try {
            const result = await this.service.processPagePayload(pageData);
            return result;
        } catch (error) {
            logger.error('Failed to process page:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Handle completion notification
     */
    async handleComplete(completeData) {
        try {
            const result = await this.service.processCompletionPayload(completeData);
            return result;
        } catch (error) {
            logger.error('Failed to process completion:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send command to connected clients
     */
    async sendCommand(action, payload = {}) {
        try {
            this.service.sendCommand(action, payload);
            return {
                success: true,
                message: 'Command sent to all connected clients'
            };
        } catch (error) {
            logger.error('Failed to send command:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Broadcast config to connected clients
     */
    async broadcastConfig(config = {}) {
        try {
            this.service.broadcastConfig(config);
            return {
                success: true,
                message: 'Config broadcasted to all connected clients'
            };
        } catch (error) {
            logger.error('Failed to broadcast config:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get received pages
     */
    async getReceivedPages() {
        try {
            const pages = this.service.getReceivedPages();
            return {
                success: true,
                count: pages.length,
                pages: pages
            };
        } catch (error) {
            logger.error('Failed to get received pages:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Clear received pages
     */
    async clearReceivedPages() {
        try {
            this.service.clearReceivedPages();
            return {
                success: true,
                message: 'Received pages cleared'
            };
        } catch (error) {
            logger.error('Failed to clear received pages:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get WebSocket handler for upgrade
     */
    getWebSocketHandler() {
        return (socket, req) => {
            this.service.handleWebSocketConnection(socket, req);
        };
    }
}

// Create singleton instance
const tampermonkeyController = new TampermonkeyController();

module.exports = tampermonkeyController;
