const fs = require('fs').promises;
const path = require('path');
const logger = require('../../../gvar/basic/logger');
const { execCmdResultText } = require('#@commander');
const { CADDY_PATHS, CADDY_USER } = require('../provider/constants');
const CaddyService = require('./service');

class CaddyStatus {
    /**
     * Get public status information (non-sensitive)
     * @returns {Promise<Object>} Public status information
     */
    static async getPublicStatus() {
        try {
            const [isRunning, version] = await Promise.all([
                CaddyService.isRunning(),
                this.getVersion()
            ]);

            return {
                running: isRunning,
                version: version,
                uptime: await this.getUptime(),
                stats: {
                    requests: await this.getRequestStats(),
                    connections: await this.getConnectionCount()
                },
                ports: await this.getActivePorts(),
                domains: await this.getHostedDomains()
            };
        } catch (error) {
            logger.error('Failed to get public status:', error.message);
            return null;
        }
    }

    /**
     * Get complete status information (including sensitive data)
     * @returns {Promise<Object>} Complete status information
     */
    static async getFullStatus() {
        try {
            const [publicStatus, configInfo] = await Promise.all([
                this.getPublicStatus(),
                this.getConfigInfo()
            ]);

            return {
                ...publicStatus,
                system: {
                    user: CADDY_USER.USER,
                    group: CADDY_USER.GROUP,
                    pid: await this.getProcessId(),
                    memory: await this.getMemoryUsage(),
                    cpu: await this.getCpuUsage()
                },
                config: configInfo,
                certificates: await this.getCertificatesInfo(),
                logs: await this.getRecentLogs(),
                security: await this.getSecurityInfo()
            };
        } catch (error) {
            logger.error('Failed to get full status:', error.message);
            return null;
        }
    }

    /**
     * Get Caddy version
     * @private
     */
    static async getVersion() {
        try {
            const output = await execCmdResultText(`${CADDY_PATHS.BIN} version`);
            return output.trim();
        } catch (error) {
            return null;
        }
    }

    /**
     * Get service uptime
     * @private
     */
    static async getUptime() {
        try {
            const output = await execCmdResultText('systemctl show caddy --property=ActiveEnterTimestamp');
            const timestamp = output.split('=')[1];
            const startTime = new Date(timestamp);
            const uptime = Date.now() - startTime.getTime();
            return this.formatUptime(uptime);
        } catch (error) {
            return null;
        }
    }

    /**
     * Get request statistics
     * @private
     */
    static async getRequestStats() {
        try {
            const output = await execCmdResultText(`${CADDY_PATHS.BIN} metrics`);
            // Parse metrics output for request stats
            return {
                total: this.parseMetric(output, 'caddy_http_requests_total'),
                active: this.parseMetric(output, 'caddy_http_requests_active')
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Get active connection count
     * @private
     */
    static async getConnectionCount() {
        try {
            const output = await execCmdResultText('ss -tnp | grep caddy | wc -l');
            return parseInt(output.trim());
        } catch (error) {
            return 0;
        }
    }

    /**
     * Get active ports
     * @private
     */
    static async getActivePorts() {
        try {
            const output = await execCmdResultText('ss -tlnp | grep caddy');
            return output.split('\n')
                .filter(line => line.trim())
                .map(line => {
                    const match = line.match(/:(\d+)/);
                    return match ? parseInt(match[1]) : null;
                })
                .filter(port => port !== null);
        } catch (error) {
            return [];
        }
    }

    /**
     * Get hosted domains
     * @private
     */
    static async getHostedDomains() {
        try {
            const config = await fs.readFile(CADDY_PATHS.CONFIG, 'utf8');
            const domains = config.match(/^[^#\s{]+/gm) || [];
            return domains.map(domain => domain.trim()).filter(Boolean);
        } catch (error) {
            return [];
        }
    }

    /**
     * Get configuration information (sensitive)
     * @private
     */
    static async getConfigInfo() {
        try {
            const [config, adapters] = await Promise.all([
                fs.readFile(CADDY_PATHS.CONFIG, 'utf8'),
                execCmdResultText(`${CADDY_PATHS.BIN} list-modules`)
            ]);

            return {
                path: CADDY_PATHS.CONFIG,
                content: config,
                modules: adapters.split('\n').filter(Boolean),
                lastModified: (await fs.stat(CADDY_PATHS.CONFIG)).mtime
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Get certificates information (sensitive)
     * @private
     */
    static async getCertificatesInfo() {
        try {
            const output = await execCmdResultText(`${CADDY_PATHS.BIN} certificates list --json`);
            return JSON.parse(output);
        } catch (error) {
            return null;
        }
    }

    /**
     * Get recent logs (sensitive)
     * @private
     */
    static async getRecentLogs(lines = 100) {
        try {
            const output = await execCmdResultText(`journalctl -u caddy -n ${lines}`);
            return output.split('\n');
        } catch (error) {
            return [];
        }
    }

    /**
     * Get security information (sensitive)
     * @private
     */
    static async getSecurityInfo() {
        try {
            const [permissions, openFiles] = await Promise.all([
                execCmdResultText(`ls -l ${CADDY_PATHS.CONFIG_DIR}`),
                execCmdResultText(`lsof -p $(pidof caddy)`)
            ]);

            return {
                permissions: permissions.split('\n'),
                openFiles: openFiles.split('\n').length,
                configPermissions: (await fs.stat(CADDY_PATHS.CONFIG)).mode,
                tlsVersion: await this.getTlsVersion()
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Format uptime duration
     * @private
     */
    static formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        return {
            days,
            hours: hours % 24,
            minutes: minutes % 60,
            seconds: seconds % 60
        };
    }

    /**
     * Parse metric value from output
     * @private
     */
    static parseMetric(output, metricName) {
        const match = output.match(new RegExp(`${metricName}\\s+([\\d.]+)`));
        return match ? parseFloat(match[1]) : 0;
    }
}

module.exports = CaddyStatus; 