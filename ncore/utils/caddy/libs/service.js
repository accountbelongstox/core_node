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

const logger = require('../../../basic/libs/logger');
const { execCmdResultText } = require('#@commander');

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