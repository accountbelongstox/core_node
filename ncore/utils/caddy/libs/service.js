const logger = require('../../../basic/libs/logger');
const { execCmdResultText } = require('#@/ncore/basic/libs/commander.js');

class CaddyService {
    /**
     * Start Caddy service
     * @returns {Promise<boolean>} Success status
     */
    static async start() {
        try {
            await execCmdResultText('systemctl start caddy');
            logger.success('Caddy service started');
            return true;
        } catch (error) {
            logger.error('Failed to start Caddy:', error.message);
            return false;
        }
    }

    /**
     * Stop Caddy service
     * @returns {Promise<boolean>} Success status
     */
    static async stop() {
        try {
            await execCmdResultText('systemctl stop caddy');
            logger.success('Caddy service stopped');
            return true;
        } catch (error) {
            logger.error('Failed to stop Caddy:', error.message);
            return false;
        }
    }

    /**
     * Restart Caddy service
     * @returns {Promise<boolean>} Success status
     */
    static async restart() {
        try {
            await execCmdResultText('systemctl restart caddy');
            logger.success('Caddy service restarted');
            return true;
        } catch (error) {
            logger.error('Failed to restart Caddy:', error.message);
            return false;
        }
    }

    /**
     * Check if Caddy service is running
     * @returns {Promise<boolean>} Running status
     */
    static async isRunning() {
        try {
            const output = await execCmdResultText('systemctl is-active caddy');
            return output.trim() === 'active';
        } catch (error) {
            return false;
        }
    }

    /**
     * Enable Caddy service to start on boot
     * @returns {Promise<boolean>} Success status
     */
    static async enable() {
        try {
            await execCmdResultText('systemctl enable caddy');
            logger.success('Caddy service enabled');
            return true;
        } catch (error) {
            logger.error('Failed to enable Caddy:', error.message);
            return false;
        }
    }
}

module.exports = CaddyService; 