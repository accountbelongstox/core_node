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

const fs = require('fs');
const path = require('path');
const logger = require('#@logger');
const globalDir = require('#@global_dir');

/**
 * Single Instance Manager for MCP Servers
 * Ensures only one instance of MCP server is running using heartbeat lock file mechanism
 *
 * This is NOT for Electron apps - it's a lightweight file-based locking mechanism
 * suitable for CLI/server applications
 *
 * How it works:
 * 1. Lock file stored in D:\programing\Users\{username}\.core_node\locks (Windows) or /var/_core_node/locks (Linux)
 * 2. Heartbeat updates lock file every 5 seconds with timestamp
 * 3. On startup, checks if lock file was updated within last 6 seconds
 * 4. If lock file is older than 6 seconds, assumes previous instance crashed and takes over
 * 5. Releases lock on process exit (SIGINT, SIGTERM, uncaughtException)
 *
 * Usage with DualModeRunner (recommended):
 * const runner = new DualModeRunner({
 *     enableSingleInstance: true,  // Enable in apps/xxx/main.js
 *     mcpConfig: { server: { name: 'my_server' } }
 * });
 * await runner.start();
 *
 * Manual usage:
 * const manager = new SingleInstanceManager({ serverName: 'my_mcp_server' });
 * if (!manager.acquireLock()) {
 *     console.error('Another instance is already running');
 *     process.exit(1);
 * }
 * // Your server code here...
 * // Lock will be automatically released on exit
 *
 * Lock files location:
 * - Linux: /var/_core_node/locks/ (primary) or ~/.core_node/locks/ (fallback)
 * - Windows: D:\programing\Users\{username}\.core_node\locks\
 *
 * @class SingleInstanceManager
 */
class SingleInstanceManager {
    constructor(options = {}) {
        this.serverName = options.serverName || 'mcp_server';
        this.lockDir = options.lockDir || this.getDefaultLockDir();
        this.lockFilePath = path.join(this.lockDir, `${this.serverName}.lock`);
        this.locked = false;
        this.heartbeatInterval = options.heartbeatInterval || 5000;
        this.staleThreshold = options.staleThreshold || 6000;
        this.heartbeatTimer = null;
    }

    /**
     * Get default lock directory from global_dir configuration
     * Uses D:\programing\Users\{username}\.core_node\locks (Windows) or /var/_core_node/locks (Linux)
     */
    getDefaultLockDir() {
        const localDir = globalDir.LOCAL_DIR;
        return path.join(localDir, 'locks');
    }

    /**
     * Ensure lock directory exists
     */
    ensureLockDirectory() {
        try {
            if (!fs.existsSync(this.lockDir)) {
                fs.mkdirSync(this.lockDir, { recursive: true });
            }
        } catch (error) {
            logger.error(`Failed to create lock directory: ${error.message}`);
            throw error;
        }
    }

    /**
     * Read lock file data
     * @returns {Object|null} Lock data or null if file doesn't exist or invalid
     */
    readLockFile() {
        try {
            if (!fs.existsSync(this.lockFilePath)) {
                return null;
            }

            const content = fs.readFileSync(this.lockFilePath, 'utf8');
            const lockData = JSON.parse(content);

            return lockData;
        } catch (error) {
            logger.error(`Failed to read lock file: ${error.message}`);
            return null;
        }
    }

    /**
     * Write lock file with current timestamp
     */
    writeLockFile() {
        try {
            const lockData = {
                pid: process.pid,
                serverName: this.serverName,
                startTime: this.startTime || Date.now(),
                lastHeartbeat: Date.now(),
                hostname: require('os').hostname()
            };

            if (!this.startTime) {
                this.startTime = lockData.startTime;
            }

            fs.writeFileSync(this.lockFilePath, JSON.stringify(lockData, null, 2), 'utf8');
            logger.debug(`Lock file updated: ${this.lockFilePath} (PID: ${process.pid})`);
        } catch (error) {
            logger.error(`Failed to write lock file: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update lock file heartbeat timestamp
     */
    updateHeartbeat() {
        if (!this.locked) {
            return;
        }

        try {
            this.writeLockFile();
            logger.debug(`Heartbeat updated for ${this.serverName}`);
        } catch (error) {
            logger.error(`Failed to update heartbeat: ${error.message}`);
        }
    }

    /**
     * Start heartbeat timer
     */
    startHeartbeat() {
        if (this.heartbeatTimer) {
            return;
        }

        this.heartbeatTimer = setInterval(() => {
            this.updateHeartbeat();
        }, this.heartbeatInterval);

        logger.info(`Heartbeat started: updating every ${this.heartbeatInterval}ms`);
    }

    /**
     * Stop heartbeat timer
     */
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
            logger.debug('Heartbeat stopped');
        }
    }

    /**
     * Check if lock file is stale (no heartbeat for more than staleThreshold)
     * @returns {boolean} True if lock is stale
     */
    isLockStale() {
        const lockData = this.readLockFile();

        if (!lockData) {
            return false;
        }

        const now = Date.now();
        const timeSinceHeartbeat = now - lockData.lastHeartbeat;

        if (timeSinceHeartbeat > this.staleThreshold) {
            logger.warn(`Lock is stale: last heartbeat was ${timeSinceHeartbeat}ms ago (threshold: ${this.staleThreshold}ms)`);
            return true;
        }

        return false;
    }

    /**
     * Release lock file
     */
    releaseLock() {
        try {
            if (fs.existsSync(this.lockFilePath)) {
                fs.unlinkSync(this.lockFilePath);
                logger.debug(`Lock file released: ${this.lockFilePath}`);
            }

            this.locked = false;
        } catch (error) {
            logger.error(`Failed to release lock: ${error.message}`);
        }
    }

    /**
     * Clean up stale lock files
     * Removes lock if no heartbeat for more than staleThreshold
     */
    cleanupStaleLock() {
        try {
            if (!fs.existsSync(this.lockFilePath)) {
                return false;
            }

            if (this.isLockStale()) {
                const lockData = this.readLockFile();
                if (lockData) {
                    logger.warn(`Stale lock detected (PID ${lockData.pid}, no heartbeat for ${Date.now() - lockData.lastHeartbeat}ms), cleaning up...`);
                }

                this.releaseLock();
                return true;
            }

            return false;
        } catch (error) {
            logger.error(`Failed to cleanup stale lock: ${error.message}`);
            return false;
        }
    }

    /**
     * Get information about existing instance
     * @returns {Object|null} Instance info or null
     */
    getExistingInstanceInfo() {
        try {
            const lockData = this.readLockFile();

            if (!lockData) {
                return null;
            }

            const now = Date.now();
            const timeSinceHeartbeat = now - lockData.lastHeartbeat;

            return {
                pid: lockData.pid,
                serverName: lockData.serverName,
                startTime: lockData.startTime,
                lastHeartbeat: lockData.lastHeartbeat,
                hostname: lockData.hostname,
                uptime: now - lockData.startTime,
                timeSinceHeartbeat: timeSinceHeartbeat,
                isStale: timeSinceHeartbeat > this.staleThreshold
            };
        } catch (error) {
            logger.error(`Failed to get existing instance info: ${error.message}`);
            return null;
        }
    }

    /**
     * Try to acquire single instance lock
     * @returns {boolean} True if this is the only instance
     */
    acquireLock() {
        try {
            this.ensureLockDirectory();

            this.cleanupStaleLock();

            const existingLock = this.readLockFile();

            if (existingLock) {
                const existingInstance = this.getExistingInstanceInfo();

                if (!existingInstance.isStale) {
                    logger.error(`Another instance is already running:`);
                    logger.error(`  PID: ${existingInstance.pid}`);
                    logger.error(`  Hostname: ${existingInstance.hostname}`);
                    logger.error(`  Uptime: ${Math.round(existingInstance.uptime / 1000)}s`);
                    logger.error(`  Last heartbeat: ${Math.round(existingInstance.timeSinceHeartbeat / 1000)}s ago`);
                    return false;
                }
            }

            this.writeLockFile();
            this.locked = true;
            this.setupCleanupHandlers();
            this.startHeartbeat();

            logger.info(`Single instance lock acquired for ${this.serverName}`);
            logger.info(`Lock file: ${this.lockFilePath}`);
            logger.info(`Heartbeat interval: ${this.heartbeatInterval}ms, Stale threshold: ${this.staleThreshold}ms`);

            return true;

        } catch (error) {
            logger.error(`Failed to acquire lock: ${error.message}`);
            return false;
        }
    }

    /**
     * Setup cleanup handlers for graceful shutdown
     */
    setupCleanupHandlers() {
        const cleanup = () => {
            this.shutdown();
        };

        process.on('exit', cleanup);
        process.on('SIGINT', () => {
            cleanup();
            process.exit(0);
        });
        process.on('SIGTERM', () => {
            cleanup();
            process.exit(0);
        });
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception:', error);
            cleanup();
            process.exit(1);
        });
    }

    /**
     * Shutdown and release lock
     */
    shutdown() {
        this.stopHeartbeat();
        this.releaseLock();
        logger.info(`Single instance lock released for ${this.serverName}`);
    }

    /**
     * Check if this instance holds the lock
     * @returns {boolean} True if locked
     */
    isLocked() {
        return this.locked;
    }

    /**
     * Force release lock (dangerous - use only for recovery)
     */
    forceReleaseLock() {
        logger.warn('Force releasing lock...');
        this.stopHeartbeat();
        this.releaseLock();
    }

    /**
     * Get lock status information
     * @returns {Object} Lock status
     */
    getStatus() {
        return {
            serverName: this.serverName,
            lockFilePath: this.lockFilePath,
            lockDir: this.lockDir,
            locked: this.locked,
            currentPid: process.pid,
            heartbeatInterval: this.heartbeatInterval,
            staleThreshold: this.staleThreshold,
            existingInstance: this.getExistingInstanceInfo()
        };
    }
}

module.exports = SingleInstanceManager;
