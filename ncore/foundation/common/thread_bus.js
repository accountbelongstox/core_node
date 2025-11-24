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

/**
 * ThreadBus - Global Process Event Management
 *
 * A centralized event bus for managing process lifecycle across all ncore services.
 * Services register themselves on startup and receive shutdown signals when the process exits.
 *
 * Usage:
 *   const { getThreadBus } = require('#@thread_bus');
 *   const bus = getThreadBus();
 *
 *   // Register a service
 *   bus.register('electron-tray', {
 *     onShutdown: async () => { ... },
 *     priority: 10  // Lower priority = shutdown first
 *   });
 *
 *   // Trigger shutdown
 *   await bus.shutdown('reason');
 */

const { EventEmitter } = require('events');

class ThreadBus extends EventEmitter {
    constructor() {
        super();

        this.services = new Map();
        this.isShuttingDown = false;
        this.shutdownPromise = null;
        this.busyServices = new Set();

        this._setupProcessHandlers();
    }

    _setupProcessHandlers() {
        process.on('SIGINT', () => this._handleSignal('SIGINT'));
        process.on('SIGTERM', () => this._handleSignal('SIGTERM'));
        process.on('exit', (code) => this.emit('exit', code));

        process.on('uncaughtException', (error) => {
            console.error('[ThreadBus] Uncaught exception:', error);
            this.shutdown('uncaughtException').finally(() => process.exit(1));
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('[ThreadBus] Unhandled rejection:', reason);
        });
    }

    async _handleSignal(signal) {
        console.log(`[ThreadBus] Received ${signal}`);
        await this.shutdown(signal);
        process.exit(0);
    }

    /**
     * Register a service with the bus
     * @param {string} name - Unique service name
     * @param {Object} options - Service options
     * @param {Function} options.onShutdown - Async function called on shutdown
     * @param {number} options.priority - Shutdown priority (lower = first, default: 50)
     * @param {Object} options.metadata - Additional service metadata
     */
    register(name, options = {}) {
        if (this.services.has(name)) {
            console.warn(`[ThreadBus] Service '${name}' already registered, updating...`);
        }

        const service = {
            name,
            onShutdown: options.onShutdown || null,
            priority: options.priority !== undefined ? options.priority : 50,
            metadata: options.metadata || {},
            registeredAt: new Date()
        };

        this.services.set(name, service);
        console.log(`[ThreadBus] Service registered: ${name} (priority: ${service.priority})`);
        this.emit('service:registered', service);

        return this;
    }

    /**
     * Unregister a service
     * @param {string} name - Service name
     */
    unregister(name) {
        if (this.services.has(name)) {
            this.services.delete(name);
            this.busyServices.delete(name);
            console.log(`[ThreadBus] Service unregistered: ${name}`);
            this.emit('service:unregistered', name);
        }
        return this;
    }

    /**
     * Mark a service as busy (prevents shutdown)
     * @param {string} name - Service name
     * @param {string} reason - Reason for being busy
     */
    setBusy(name, reason = null) {
        if (this.services.has(name)) {
            this.busyServices.add(name);
            const service = this.services.get(name);
            service.busyReason = reason;
            this.emit('service:busy', { name, reason });
        }
        return this;
    }

    /**
     * Mark a service as not busy
     * @param {string} name - Service name
     */
    setIdle(name) {
        this.busyServices.delete(name);
        if (this.services.has(name)) {
            const service = this.services.get(name);
            delete service.busyReason;
            this.emit('service:idle', name);
        }
        return this;
    }

    /**
     * Check if any service is busy
     * @returns {{isBusy: boolean, services: Array}}
     */
    checkBusy() {
        const busyList = [];
        for (const name of this.busyServices) {
            const service = this.services.get(name);
            if (service) {
                busyList.push({
                    name,
                    reason: service.busyReason || 'Unknown'
                });
            }
        }
        return {
            isBusy: busyList.length > 0,
            services: busyList
        };
    }

    /**
     * Check if shutdown is allowed
     * @returns {{canShutdown: boolean, reason: string|null}}
     */
    canShutdown() {
        const busyCheck = this.checkBusy();
        if (busyCheck.isBusy) {
            const reasons = busyCheck.services.map(s => `${s.name}: ${s.reason}`).join(', ');
            return {
                canShutdown: false,
                reason: `Busy services: ${reasons}`
            };
        }
        return {
            canShutdown: true,
            reason: null
        };
    }

    /**
     * Shutdown all registered services
     * @param {string} reason - Reason for shutdown
     * @param {boolean} force - Force shutdown even if busy
     * @returns {Promise<{success: boolean, results: Array}>}
     */
    async shutdown(reason = 'Requested', force = false) {
        if (this.isShuttingDown) {
            console.log('[ThreadBus] Shutdown already in progress');
            return this.shutdownPromise;
        }

        const shutdownCheck = this.canShutdown();
        if (!shutdownCheck.canShutdown && !force) {
            console.log(`[ThreadBus] Cannot shutdown: ${shutdownCheck.reason}`);
            return {
                success: false,
                reason: shutdownCheck.reason
            };
        }

        this.isShuttingDown = true;
        console.log(`[ThreadBus] Starting shutdown: ${reason}`);
        this.emit('shutdown:start', reason);

        this.shutdownPromise = this._executeShutdown(reason);
        return this.shutdownPromise;
    }

    async _executeShutdown(reason) {
        const results = [];

        // Sort services by priority (lower = first)
        const sortedServices = Array.from(this.services.values())
            .sort((a, b) => a.priority - b.priority);

        for (const service of sortedServices) {
            if (service.onShutdown) {
                try {
                    console.log(`[ThreadBus] Shutting down service: ${service.name}`);
                    await Promise.race([
                        service.onShutdown(reason),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Timeout')), 10000)
                        )
                    ]);
                    results.push({ name: service.name, success: true });
                    console.log(`[ThreadBus] Service shutdown complete: ${service.name}`);
                } catch (error) {
                    console.error(`[ThreadBus] Service shutdown failed: ${service.name}`, error.message);
                    results.push({ name: service.name, success: false, error: error.message });
                }
            } else {
                results.push({ name: service.name, success: true, skipped: true });
            }
        }

        this.emit('shutdown:complete', results);
        console.log('[ThreadBus] Shutdown complete');

        return {
            success: true,
            results
        };
    }

    /**
     * Send a message to all services
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    broadcast(event, data) {
        this.emit(event, data);
        return this;
    }

    /**
     * Get status of all services
     * @returns {Object}
     */
    getStatus() {
        const services = [];
        for (const [name, service] of this.services) {
            services.push({
                name,
                priority: service.priority,
                isBusy: this.busyServices.has(name),
                busyReason: service.busyReason || null,
                registeredAt: service.registeredAt,
                metadata: service.metadata
            });
        }

        return {
            isShuttingDown: this.isShuttingDown,
            serviceCount: this.services.size,
            busyCount: this.busyServices.size,
            canShutdown: this.canShutdown(),
            services
        };
    }

    /**
     * Get list of registered service names
     * @returns {Array<string>}
     */
    getServiceNames() {
        return Array.from(this.services.keys());
    }
}

// Singleton instance
let instance = null;

function getThreadBus() {
    if (!instance) {
        instance = new ThreadBus();
    }
    return instance;
}

module.exports = {
    ThreadBus,
    getThreadBus
};
