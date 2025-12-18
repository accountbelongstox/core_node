const EventEmitter = require('events');
const logger = require('#@logger');

const THREAD_POOL_THREADS_KEY = 'heartbeat.thread_pool.threads';
const THREAD_POOL_TASK_HANDLERS_KEY = 'heartbeat.thread_pool.task_type_handlers';

const ThreadStatus = {
    STARTING: 'starting',
    RUNNING: 'running',
    STOPPED: 'stopped',
    ERROR: 'error'
};

class ThreadInfo {
    constructor(options) {
        this.name = options.name;
        this.instance = options.instance;
        this.taskHandlers = options.taskHandlers || {};
        this.threadId = options.threadId || null;
        this.status = options.status || ThreadStatus.STARTING;
        this.startedAt = Date.now();
        this.lastHeartbeat = Date.now();
        this.metadata = options.metadata || {};
        this.shutdownPriority = options.shutdownPriority || 50;
    }

    updateHeartbeat() {
        this.lastHeartbeat = Date.now();
        if (this.status === ThreadStatus.STARTING) {
            this.status = ThreadStatus.RUNNING;
        }
    }

    isAlive() {
        if (this.instance && typeof this.instance.isAlive === 'function') {
            return this.instance.isAlive();
        }
        return this.status === ThreadStatus.RUNNING;
    }

    getUptime() {
        return (Date.now() - this.startedAt) / 1000;
    }

    getHeartbeatAge() {
        return (Date.now() - this.lastHeartbeat) / 1000;
    }

    getTaskTypes() {
        return Object.keys(this.taskHandlers);
    }

    getHandler(taskType) {
        return this.taskHandlers[taskType] || null;
    }

    toDict() {
        return {
            name: this.name,
            threadId: this.threadId,
            taskTypes: this.getTaskTypes(),
            status: this.status,
            startedAt: this.startedAt,
            lastHeartbeat: this.lastHeartbeat,
            uptime: this.getUptime(),
            heartbeatAge: this.getHeartbeatAge(),
            alive: this.isAlive(),
            metadata: this.metadata,
            shutdownPriority: this.shutdownPriority
        };
    }
}

class GlobalThreadPool {
    constructor() {
        if (GlobalThreadPool._instance) {
            return GlobalThreadPool._instance;
        }

        this._threads = new Map();
        this._taskTypeHandlers = new Map();
        this._lock = false;

        GlobalThreadPool._instance = this;
    }

    async _acquireLock() {
        while (this._lock) {
            await new Promise(resolve => setImmediate(resolve));
        }
        this._lock = true;
    }

    _releaseLock() {
        this._lock = false;
    }

    _syncToEncyclopedia() {
        try {
            const ENCYCLOPEDIA = require('#@foundation/encyclopedia');

            const threadsData = {};
            this._threads.forEach((info, name) => {
                threadsData[name] = info.toDict();
            });

            const taskHandlersData = {};
            this._taskTypeHandlers.forEach((handlers, taskType) => {
                taskHandlersData[taskType] = Array.from(handlers);
            });

            ENCYCLOPEDIA.add(THREAD_POOL_THREADS_KEY, threadsData);
            ENCYCLOPEDIA.add(THREAD_POOL_TASK_HANDLERS_KEY, taskHandlersData);
        } catch (error) {
            logger.warn('[ThreadPool] Encyclopedia not available, skipping sync');
        }
    }

    async registerThread(name, instance, taskHandlers, metadata = null, shutdownPriority = null) {
        await this._acquireLock();

        try {
            if (this._threads.has(name)) {
                logger.warn(`[ThreadPool] Thread '${name}' already registered`);
                return false;
            }

            if (!taskHandlers || Object.keys(taskHandlers).length === 0) {
                logger.error(`[ThreadPool] Thread '${name}' has no task handlers`);
                return false;
            }

            if (shutdownPriority === null) {
                const { THREAD_REGISTRY } = require('./registry');
                const registryEntry = THREAD_REGISTRY[name] || {};
                shutdownPriority = registryEntry.shutdown_priority || 50;
            }

            const threadInfo = new ThreadInfo({
                name,
                instance,
                taskHandlers,
                metadata,
                shutdownPriority
            });

            this._threads.set(name, threadInfo);

            Object.keys(taskHandlers).forEach(taskType => {
                if (!this._taskTypeHandlers.has(taskType)) {
                    this._taskTypeHandlers.set(taskType, []);
                }
                this._taskTypeHandlers.get(taskType).push(name);
            });

            this._syncToEncyclopedia();

            const taskTypesStr = Object.keys(taskHandlers).join(', ');
            logger.success(`[ThreadPool] Registered thread: ${name} (task_types: ${taskTypesStr})`);
            return true;

        } finally {
            this._releaseLock();
        }
    }

    async unregisterThread(name) {
        await this._acquireLock();

        try {
            if (!this._threads.has(name)) {
                return false;
            }

            const threadInfo = this._threads.get(name);

            Object.keys(threadInfo.taskHandlers).forEach(taskType => {
                if (this._taskTypeHandlers.has(taskType)) {
                    const handlers = this._taskTypeHandlers.get(taskType);
                    const index = handlers.indexOf(name);
                    if (index !== -1) {
                        handlers.splice(index, 1);
                    }
                    if (handlers.length === 0) {
                        this._taskTypeHandlers.delete(taskType);
                    }
                }
            });

            this._threads.delete(name);

            this._syncToEncyclopedia();

            logger.info(`[ThreadPool] Unregistered thread: ${name}`);
            return true;

        } finally {
            this._releaseLock();
        }
    }

    getThread(name) {
        return this._threads.get(name) || null;
    }

    getAllThreads() {
        return Array.from(this._threads.values());
    }

    getHandlersForTaskType(taskType) {
        const threadNames = this._taskTypeHandlers.get(taskType) || [];
        const handlers = [];

        threadNames.forEach(name => {
            const threadInfo = this._threads.get(name);
            if (threadInfo) {
                const handlerFn = threadInfo.getHandler(taskType);
                if (handlerFn) {
                    handlers.push([threadInfo, handlerFn]);
                }
            }
        });

        return handlers;
    }

    isThreadAlive(name) {
        const threadInfo = this.getThread(name);
        return threadInfo ? threadInfo.isAlive() : false;
    }

    async updateHeartbeat(name) {
        await this._acquireLock();

        try {
            const threadInfo = this._threads.get(name);
            if (threadInfo) {
                threadInfo.updateHeartbeat();
                this._syncToEncyclopedia();
            }
        } finally {
            this._releaseLock();
        }
    }

    async updateStatus(name, status) {
        await this._acquireLock();

        try {
            const threadInfo = this._threads.get(name);
            if (threadInfo) {
                threadInfo.status = status;
                this._syncToEncyclopedia();
                logger.info(`[ThreadPool] Thread '${name}' status: ${status}`);
            }
        } finally {
            this._releaseLock();
        }
    }

    checkHealth(heartbeatTimeout = 30.0) {
        const healthy = [];
        const unhealthy = [];

        this._threads.forEach((threadInfo, name) => {
            if (!threadInfo.isAlive()) {
                unhealthy.push(name);
            } else if (threadInfo.getHeartbeatAge() > heartbeatTimeout) {
                unhealthy.push(name);
            } else {
                healthy.push(name);
            }
        });

        return {
            healthy,
            unhealthy
        };
    }

    getStats() {
        const total = this._threads.size;
        const statusCounts = {};

        this._threads.forEach(threadInfo => {
            const status = threadInfo.status;
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        const taskTypeHandlers = {};
        this._taskTypeHandlers.forEach((handlers, taskType) => {
            taskTypeHandlers[taskType] = [...handlers];
        });

        const threads = {};
        this._threads.forEach((info, name) => {
            threads[name] = info.toDict();
        });

        return {
            totalThreads: total,
            statusCounts,
            taskTypeHandlers,
            threads
        };
    }

    getShutdownOrder() {
        const threadsWithPriority = [];

        this._threads.forEach((info, name) => {
            threadsWithPriority.push([name, info, info.shutdownPriority]);
        });

        threadsWithPriority.sort((a, b) => a[2] - b[2]);

        return threadsWithPriority;
    }

    async shutdownByPriority(shutdownCallback = null, timeoutPerThread = 5000) {
        const shutdownOrder = this.getShutdownOrder();
        const results = {};

        logger.info('[ThreadPool] Starting prioritized shutdown...');
        logger.info(`[ThreadPool] Shutdown order: ${shutdownOrder.map(x => x[0]).join(', ')}`);

        for (const [threadName, threadInfo, priority] of shutdownOrder) {
            logger.warn(`[ThreadPool] Shutting down '${threadName}' (priority: ${priority})...`);

            try {
                if (shutdownCallback) {
                    await shutdownCallback(threadName, threadInfo.instance);
                } else if (threadInfo.instance && typeof threadInfo.instance.stop === 'function') {
                    await threadInfo.instance.stop();
                } else {
                    logger.warn(`[ThreadPool] No shutdown method for '${threadName}'`);
                }

                await this.unregisterThread(threadName);

                logger.success(`[ThreadPool] Thread '${threadName}' stopped successfully`);
                results[threadName] = true;

            } catch (error) {
                logger.error(`[ThreadPool] Error shutting down '${threadName}':`, error);
                results[threadName] = false;
            }
        }

        logger.success('[ThreadPool] Prioritized shutdown complete');
        return results;
    }
}

let _globalThreadPool = null;

function getGlobalThreadPool() {
    if (!_globalThreadPool) {
        _globalThreadPool = new GlobalThreadPool();
    }
    return _globalThreadPool;
}

function getThreadPoolFromEncyclopedia() {
    try {
        const ENCYCLOPEDIA = require('#@foundation/encyclopedia');
        const threads = ENCYCLOPEDIA.get(THREAD_POOL_THREADS_KEY);
        const taskHandlers = ENCYCLOPEDIA.get(THREAD_POOL_TASK_HANDLERS_KEY);

        if (threads === null || taskHandlers === null) {
            return null;
        }

        return {
            threads,
            taskTypeHandlers: taskHandlers
        };
    } catch (error) {
        return null;
    }
}

module.exports = {
    ThreadStatus,
    ThreadInfo,
    GlobalThreadPool,
    getGlobalThreadPool,
    getThreadPoolFromEncyclopedia,
    THREAD_POOL_THREADS_KEY,
    THREAD_POOL_TASK_HANDLERS_KEY
};
