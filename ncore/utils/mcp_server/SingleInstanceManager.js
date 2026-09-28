'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const logger = require('#@logger');
const globalDir = require('#@global_dir');
const { getThreadBus } = require('#@thread_bus');

const DEFAULT_HEARTBEAT_INTERVAL_MS = 5000;
const STALE_HEARTBEAT_MULTIPLIER = 3;
const ACQUIRE_ATTEMPTS = 2;
const SHUTDOWN_PRIORITY_LAST = 1000;

/**
 * Single Instance Manager for MCP Servers
 * Ensures only one instance of MCP server is running using heartbeat lock file mechanism
 *
 * This is NOT for Electron apps - it's a lightweight file-based locking mechanism
 * suitable for CLI/server applications
 *
 * How it works:
 * 1. Lock file stored under the centralized core_node runtime data directory.
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
 * - Linux and Windows: <core_node_data_dir>/locks/
 *
 * @class SingleInstanceManager
 */
class SingleInstanceManager {
    constructor(options = {}) {
        this.serverName = options.serverName || 'mcp_server';
        this.lockDir = options.lockDir || this.getDefaultLockDir();
        this.lockFilePath = path.join(this.lockDir, `${this.serverName}.lock`);
        this.locked = false;
        this.heartbeatInterval = options.heartbeatInterval || DEFAULT_HEARTBEAT_INTERVAL_MS;
        this.staleThreshold = options.staleThreshold || this.heartbeatInterval * STALE_HEARTBEAT_MULTIPLIER;
        this.heartbeatTimer = null;
        this.hostname = os.hostname();
        this.cleanupRegistered = false;
    }

    /**
     * Get default lock directory from global_dir configuration
     * Uses <core_node_data_dir>/locks through global_dir.LOCAL_DIR.
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
            fs.mkdirSync(this.lockDir, { recursive: true });
            return true;
        } catch (error) {
            logger.error(`Failed to create lock directory: ${error.message}`);
            return false;
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

    buildLockData() {
        if (!this.startTime) {
            this.startTime = Date.now();
        }
        return {
            pid: process.pid,
            serverName: this.serverName,
            startTime: this.startTime,
            lastHeartbeat: Date.now(),
            hostname: this.hostname
        };
    }

    /**
     * Create the lock file atomically; fails when another process created it first
     * @returns {boolean} True if this process created the lock file
     */
    createLockFile() {
        let fd = null;
        try {
            fd = fs.openSync(this.lockFilePath, 'wx');
            fs.writeSync(fd, JSON.stringify(this.buildLockData(), null, 2));
            return true;
        } catch (error) {
            if (error.code !== 'EEXIST') {
                logger.error(`Failed to create lock file: ${error.message}`);
            }
            return false;
        } finally {
            if (fd !== null) {
                fs.closeSync(fd);
            }
        }
    }

    /**
     * Rewrite the lock file (temp file plus rename) while this process owns it
     * @returns {boolean} True on success
     */
    writeLockFile() {
        const tempPath = `${this.lockFilePath}.${process.pid}.tmp`;
        try {
            fs.writeFileSync(tempPath, JSON.stringify(this.buildLockData(), null, 2), 'utf8');
            fs.renameSync(tempPath, this.lockFilePath);
            logger.debug(`Lock file updated: ${this.lockFilePath} (PID: ${process.pid})`);
            return true;
        } catch (error) {
            logger.error(`Failed to write lock file: ${error.message}`);
            return false;
        }
    }

    isOwnLock(lockData) {
        return Boolean(lockData) && lockData.pid === process.pid && lockData.hostname === this.hostname;
    }

    isPidAlive(pid) {
        try {
            process.kill(pid, 0);
            return true;
        } catch (error) {
            return error.code === 'EPERM';
        }
    }

    /**
     * A lock is held when its owner process is alive (same host) or its heartbeat is fresh (other host)
     * @param {Object|null} lockData - Lock file content
     * @returns {boolean}
     */
    isLockHeld(lockData) {
        if (!lockData || !Number.isInteger(lockData.pid)) {
            return false;
        }
        if (lockData.hostname === this.hostname) {
            return lockData.pid === process.pid || this.isPidAlive(lockData.pid);
        }
        return Date.now() - Number(lockData.lastHeartbeat || 0) <= this.staleThreshold;
    }

    /**
     * Update lock file heartbeat timestamp; stop if another process now owns the lock
     */
    updateHeartbeat() {
        if (!this.locked) {
            return;
        }

        const lockData = this.readLockFile();
        if (!this.isOwnLock(lockData)) {
            logger.error(`Lock for ${this.serverName} is no longer owned by PID ${process.pid}; stopping heartbeat`);
            this.locked = false;
            this.stopHeartbeat();
            return;
        }

        if (this.writeLockFile()) {
            logger.debug(`Heartbeat updated for ${this.serverName}`);
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
        this.heartbeatTimer.unref();

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

        if (!lockData || this.isLockHeld(lockData)) {
            return false;
        }

        logger.warn(`Lock is stale: PID ${lockData.pid} on ${lockData.hostname} is not running or its heartbeat expired`);
        return true;
    }

    /**
     * Release lock file, only when this process owns it
     */
    releaseLock() {
        try {
            const lockData = this.readLockFile();
            if (this.isOwnLock(lockData)) {
                fs.unlinkSync(this.lockFilePath);
                logger.debug(`Lock file released: ${this.lockFilePath}`);
            }
            this.locked = false;
        } catch (error) {
            logger.error(`Failed to release lock: ${error.message}`);
        }
    }

    /**
     * Remove a lock file whose owner is gone, unless it changed since it was read
     * @param {Object|null} staleData - Lock content that was judged stale
     */
    removeStaleLock(staleData) {
        try {
            const current = this.readLockFile();
            const unchanged = !current || !staleData
                || (current.pid === staleData.pid && current.startTime === staleData.startTime && current.hostname === staleData.hostname);
            if (unchanged && fs.existsSync(this.lockFilePath)) {
                fs.unlinkSync(this.lockFilePath);
                logger.warn(`Removed stale lock ${this.lockFilePath}`);
            }
        } catch (error) {
            logger.error(`Failed to remove stale lock: ${error.message}`);
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
                this.removeStaleLock(this.readLockFile());
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
                isStale: !this.isLockHeld(lockData)
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
            if (!this.ensureLockDirectory()) {
                return false;
            }

            let created = false;
            for (let attempt = 0; attempt < ACQUIRE_ATTEMPTS && !created; attempt++) {
                created = this.createLockFile();
                if (created) {
                    break;
                }

                const existingLock = this.readLockFile();
                if (this.isLockHeld(existingLock)) {
                    const existingInstance = this.getExistingInstanceInfo();
                    logger.error(`Another instance is already running:`);
                    logger.error(`  PID: ${existingInstance.pid}`);
                    logger.error(`  Hostname: ${existingInstance.hostname}`);
                    logger.error(`  Uptime: ${Math.round(existingInstance.uptime / 1000)}s`);
                    logger.error(`  Last heartbeat: ${Math.round(existingInstance.timeSinceHeartbeat / 1000)}s ago`);
                    return false;
                }

                this.removeStaleLock(existingLock);
            }

            if (!created) {
                logger.error(`Could not create lock file ${this.lockFilePath}`);
                return false;
            }

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
        if (this.cleanupRegistered) {
            return;
        }
        this.cleanupRegistered = true;

        // Signals are coordinated by ThreadBus; the lock is released last, after async shutdowns finish
        getThreadBus().register(`single-instance:${this.serverName}`, {
            priority: SHUTDOWN_PRIORITY_LAST,
            onShutdown: async () => this.shutdown()
        });
        process.on('exit', () => {
            if (this.locked) {
                this.shutdown();
            }
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
        this.removeStaleLock(null);
        this.locked = false;
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
