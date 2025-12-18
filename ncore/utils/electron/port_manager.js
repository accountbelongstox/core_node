// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

/**
 * Port Manager - Port Allocation and Availability Detection
 *
 * Ported from pycore/pyutils/native_ui/step2_port_url/port_allocator.py
 * Adapted for Electron environment with ncore standards
 *
 * Usage:
 *   const { PortManager } = require('./port_manager');
 *   const manager = new PortManager();
 *   const port = await manager.allocatePort(3000);
 */

const net = require('net');
const logger = require('#@logger');

class PortManager {
    constructor(options = {}) {
        this.startPort = options.startPort || 3000;
        this.endPort = options.endPort || 65535;
        this.allocatedPorts = new Set();
        this.portCheckTimeout = options.portCheckTimeout || 1000;
    }

    async isPortAvailable(port, host = '0.0.0.0') {
        return new Promise((resolve) => {
            const server = net.createServer();

            const timeout = setTimeout(() => {
                server.close();
                resolve(false);
            }, this.portCheckTimeout);

            server.once('error', (err) => {
                clearTimeout(timeout);
                if (err.code === 'EADDRINUSE') {
                    resolve(false);
                } else {
                    logger.warn(`[PortManager] Error checking port ${port}:`, err);
                    resolve(false);
                }
            });

            server.once('listening', () => {
                clearTimeout(timeout);
                server.close(() => {
                    resolve(true);
                });
            });

            server.listen(port, host);
        });
    }

    async allocatePort(preferredPort = null, host = '0.0.0.0') {
        let port = preferredPort;

        if (port !== null) {
            const available = await this.isPortAvailable(port, host);
            if (available) {
                this.allocatedPorts.add(port);
                logger.info(`[PortManager] Allocated preferred port: ${port}`);
                return port;
            } else {
                logger.warn(`[PortManager] Preferred port ${port} not available, searching for alternative`);
            }
        }

        for (let candidatePort = this.startPort; candidatePort <= this.endPort; candidatePort++) {
            if (this.allocatedPorts.has(candidatePort)) {
                continue;
            }

            const available = await this.isPortAvailable(candidatePort, host);
            if (available) {
                this.allocatedPorts.add(candidatePort);
                logger.info(`[PortManager] Allocated port: ${candidatePort}`);
                return candidatePort;
            }
        }

        throw new Error(`[PortManager] No available ports in range ${this.startPort}-${this.endPort}`);
    }

    releasePort(port) {
        if (this.allocatedPorts.has(port)) {
            this.allocatedPorts.delete(port);
            logger.info(`[PortManager] Released port: ${port}`);
            return true;
        }
        return false;
    }

    releaseAllPorts() {
        const count = this.allocatedPorts.size;
        this.allocatedPorts.clear();
        logger.info(`[PortManager] Released ${count} port(s)`);
    }

    getAllocatedPorts() {
        return Array.from(this.allocatedPorts);
    }

    isPortAllocated(port) {
        return this.allocatedPorts.has(port);
    }

    async findAvailablePortInRange(startPort, endPort, host = '0.0.0.0') {
        for (let port = startPort; port <= endPort; port++) {
            if (this.allocatedPorts.has(port)) {
                continue;
            }

            const available = await this.isPortAvailable(port, host);
            if (available) {
                return port;
            }
        }

        return null;
    }
}

let _globalPortManager = null;

function getGlobalPortManager() {
    if (_globalPortManager === null) {
        _globalPortManager = new PortManager();
    }
    return _globalPortManager;
}

module.exports = {
    PortManager,
    getGlobalPortManager
};
