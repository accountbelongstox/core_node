import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../logger/logger.js';

const execAsync = promisify(exec);

export const execCaddy = async (args = []) => {
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

export const validateConfig = async () => {
    try {
        await execCaddy(['validate']);
        return true;
    } catch (error) {
        logger.error('CaddyValidateError', error);
        return false;
    }
}; 