import os from 'os';
import { execSync } from 'child_process';
import logger from '../logger/logger.js';

export const getSystemInfo = async () => {
    const info = {
        os: {
            type: os.type(),
            platform: os.platform(),
            release: os.release(),
            arch: os.arch(),
            uptime: os.uptime(),
        },
        node: {
            version: process.version,
            env: process.env.NODE_ENV || 'development'
        },
        system: {
            hostname: os.hostname(),
            cpus: os.cpus().length,
            memory: {
                total: os.totalmem(),
                free: os.freemem()
            }
        },
        caddy: {
            installed: false,
            version: null,
            supported: os.platform() !== 'win32'
        }
    };

    // 检查 Caddy 版本
    if (info.caddy.supported) {
        try {
            const caddyVersion = execSync('caddy version').toString().trim();
            info.caddy.installed = true;
            info.caddy.version = caddyVersion;
        } catch (error) {
            logger.debug('Caddy not installed or not in PATH');
        }
    } else {
        info.caddy.message = 'Caddy is not supported on Windows platform';
    }

    return info;
}; 