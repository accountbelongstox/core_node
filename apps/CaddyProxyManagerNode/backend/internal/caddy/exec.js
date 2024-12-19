const { exec } = require('child_process');
    const { promisify } = require('util');
    const logger = require('../logger/logger.js');

    const execAsync = promisify(exec);

    exports.execCaddy = async (args = []) => {
        try {
            const command = ['caddy', ...args].join(' ');
            const { stdout, stderr } = await execAsync(command);
            
            if (stdout) {
                logger.debug(`Caddy stdout: ${stdout}`);
            }
            
            if (stderr) {
                logger.warn(`Caddy stderr: ${stderr}`);
            }
            
            return true;
        } catch (error) {
            logger.error('CaddyExecError', error);
            throw error;
        }
    };

    exports.validateConfig = async () => {
        try {
            await exports.execCaddy(['validate']);
            return true;
        } catch (error) {
            logger.error('CaddyValidateError', error);
            return false;
        }
    };