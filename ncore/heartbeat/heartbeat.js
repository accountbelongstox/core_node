const EventEmitter = require('events');
const logger = require('#@logger');

class CallbackInfo {
    constructor(name, callback, interval, enabled = true) {
        this.name = name;
        this.callback = callback;
        this.interval = interval;
        this.enabled = enabled;
        this.lastRunTick = 0;
        this.runCount = 0;
    }

    shouldRun(currentTick) {
        if (!this.enabled) {
            return false;
        }
        return (currentTick - this.lastRunTick) >= this.interval;
    }

    markRun(currentTick) {
        this.lastRunTick = currentTick;
        this.runCount++;
    }
}

class HeartbeatPusher extends EventEmitter {
    constructor(tickInterval = 1000, threadPool = null) {
        super();

        this.tickInterval = tickInterval;
        this._stopRequested = false;
        this._running = false;
        this._intervalId = null;

        try {
            const { getGlobalTaskQueue } = require('#@foundation/task_queue');
            this._taskQueue = getGlobalTaskQueue();
        } catch (error) {
            logger.warn('[Heartbeat] TaskQueue not available');
            this._taskQueue = null;
        }

        try {
            const { getGlobalThreadPool } = require('#@ncore/thread_pool');
            this._threadPool = threadPool || getGlobalThreadPool();
        } catch (error) {
            logger.warn('[Heartbeat] ThreadPool not available');
            this._threadPool = null;
        }

        this._callbacks = new Map();
        this._totalTicks = 0;
        this._startTime = null;
        this._tasksPushed = 0;
        this._tasksRequeued = 0;
        this._tasksFailed = 0;

        try {
            const threadBus = require('#@thread_bus');
            threadBus.registerShutdownHandler(
                () => this.stop(),
                100,
                'heartbeat'
            );
            logger.info('[Heartbeat] Registered THREAD_BUS shutdown handler (priority=100)');
        } catch (error) {
            logger.warn('[Heartbeat] THREAD_BUS not available, shutdown handler not registered');
        }
    }

    registerCallback(name, callback, interval = 1, enabled = true) {
        const callbackInfo = new CallbackInfo(name, callback, interval, enabled);
        this._callbacks.set(name, callbackInfo);
        logger.success(`[Heartbeat] Registered callback: ${name} (interval=${interval}s)`);
    }

    unregisterCallback(name) {
        if (this._callbacks.has(name)) {
            this._callbacks.delete(name);
            logger.info(`[Heartbeat] Unregistered callback: ${name}`);
        }
    }

    enableCallback(name) {
        const callbackInfo = this._callbacks.get(name);
        if (callbackInfo) {
            callbackInfo.enabled = true;
        }
    }

    disableCallback(name) {
        const callbackInfo = this._callbacks.get(name);
        if (callbackInfo) {
            callbackInfo.enabled = false;
        }
    }

    start() {
        if (this._running) {
            logger.warn('[Heartbeat] Already running');
            return;
        }

        this._running = true;
        this._stopRequested = false;
        this._startTime = Date.now();

        logger.success(`[Heartbeat] Started (tick=${this.tickInterval}ms)`);

        this._intervalId = setInterval(() => {
            this._tick();
        }, this.tickInterval);
    }

    _tick() {
        try {
            const threadBus = require('#@thread_bus');
            if (threadBus.isShutdownRequested && threadBus.isShutdownRequested()) {
                logger.warn('[Heartbeat] THREAD_BUS shutdown detected, stopping...');
                this.stop();
                return;
            }
        } catch (error) {
        }

        if (this._stopRequested) {
            return;
        }

        this._totalTicks++;

        try {
            this._executeCallbacks();

            if (this._taskQueue) {
                this._processTasks();
            }

            try {
                const threadBus = require('#@thread_bus');
                threadBus.triggerEvent('heartbeat.tick', {
                    tickNumber: this._totalTicks,
                    timestamp: Date.now(),
                    uptime: (Date.now() - this._startTime) / 1000
                }, true);
            } catch (error) {
            }

        } catch (error) {
            logger.error('[Heartbeat] Tick error:', error);
        }

        if (this._totalTicks % 10 === 0) {
            const currentTimeStr = new Date().toISOString();
            logger.info(`[Heartbeat] Tick #${this._totalTicks}, Time: ${currentTimeStr}`);
        }
    }

    _executeCallbacks() {
        for (const [name, callbackInfo] of this._callbacks.entries()) {
            if (callbackInfo.shouldRun(this._totalTicks)) {
                try {
                    callbackInfo.callback();
                    callbackInfo.markRun(this._totalTicks);
                } catch (error) {
                    logger.error(`[Heartbeat] Callback '${name}' error:`, error);
                }
            }
        }
    }

    _processTasks() {
        if (!this._taskQueue || !this._threadPool) {
            return;
        }

        const task = this._taskQueue.get(false, 0.1);

        if (!task) {
            return;
        }

        const { TaskState } = require('#@foundation/task_queue');

        if (task.state === TaskState.CANCELLED) {
            return;
        }

        const handlers = this._threadPool.getHandlersForTaskType(task.taskType);

        if (!handlers || handlers.length === 0) {
            logger.warn(`[Heartbeat] No handler for task: ${task.taskType}`);
            task.markFailed(`No handler for task_type: ${task.taskType}`);
            this._tasksFailed++;
            return;
        }

        const { ThreadStatus } = require('#@ncore/thread_pool');

        for (const [threadInfo, handlerFn] of handlers) {
            if (threadInfo.status !== ThreadStatus.RUNNING) {
                continue;
            }

            try {
                const accepted = handlerFn(task);

                if (accepted) {
                    this._tasksPushed++;
                    return;
                }

            } catch (error) {
                logger.error(`[Heartbeat] Handler error ('${threadInfo.name}'):`, error);
                continue;
            }
        }

        this._tasksRequeued++;
        this._taskQueue.put(task, false);
    }

    stop() {
        logger.warn('[Heartbeat] Stopping...');
        this._stopRequested = true;

        if (this._intervalId) {
            clearInterval(this._intervalId);
            this._intervalId = null;
        }

        this._running = false;
        logger.info('[Heartbeat] Stopped');
    }

    isRunning() {
        return this._running;
    }

    getStats() {
        const uptime = this._startTime ? (Date.now() - this._startTime) / 1000 : 0;

        const callbackStats = {};
        for (const [name, callbackInfo] of this._callbacks.entries()) {
            callbackStats[name] = {
                enabled: callbackInfo.enabled,
                interval: callbackInfo.interval,
                lastRunTick: callbackInfo.lastRunTick,
                runCount: callbackInfo.runCount,
                ticksUntilNext: Math.max(0, callbackInfo.interval - (this._totalTicks - callbackInfo.lastRunTick))
            };
        }

        return {
            running: this._running,
            uptime,
            totalTicks: this._totalTicks,
            tasksPushed: this._tasksPushed,
            tasksRequeued: this._tasksRequeued,
            tasksFailed: this._tasksFailed,
            tickInterval: this.tickInterval,
            queueSize: this._taskQueue ? this._taskQueue.size() : 0,
            callbacks: callbackStats
        };
    }
}

class HeartbeatSystem {
    constructor() {
        if (HeartbeatSystem._instance) {
            return HeartbeatSystem._instance;
        }

        this._running = false;

        try {
            const { getGlobalTaskQueue } = require('#@foundation/task_queue');
            this._taskQueue = getGlobalTaskQueue();
        } catch (error) {
            this._taskQueue = null;
        }

        try {
            const { getGlobalThreadPool } = require('#@ncore/thread_pool');
            this._threadPool = getGlobalThreadPool();
        } catch (error) {
            this._threadPool = null;
        }

        this._heartbeatPusher = null;

        this._config = {
            tickInterval: 1000
        };

        HeartbeatSystem._instance = this;
    }

    start(tickInterval = null) {
        if (this._running) {
            logger.warn('[HeartbeatSystem] Already running');
            return;
        }

        if (tickInterval !== null) {
            this._config.tickInterval = tickInterval;
        }

        logger.success('[HeartbeatSystem] Starting...');

        this._heartbeatPusher = new HeartbeatPusher(
            this._config.tickInterval,
            this._threadPool
        );
        this._heartbeatPusher.start();

        this._running = true;

        logger.success('[HeartbeatSystem] Started successfully');
    }

    stop() {
        if (!this._running) {
            return;
        }

        logger.warn('[HeartbeatSystem] Stopping...');

        if (this._heartbeatPusher) {
            this._heartbeatPusher.stop();
        }

        this._running = false;

        logger.info('[HeartbeatSystem] Stopped');
    }

    isRunning() {
        return this._running && (
            this._heartbeatPusher !== null &&
            this._heartbeatPusher.isRunning()
        );
    }

    registerCallback(name, callback, interval = 1, enabled = true) {
        if (this._heartbeatPusher) {
            this._heartbeatPusher.registerCallback(name, callback, interval, enabled);
        } else {
            logger.warn('[HeartbeatSystem] Not started, cannot register callback');
        }
    }

    unregisterCallback(name) {
        if (this._heartbeatPusher) {
            this._heartbeatPusher.unregisterCallback(name);
        }
    }

    enableCallback(name) {
        if (this._heartbeatPusher) {
            this._heartbeatPusher.enableCallback(name);
        }
    }

    disableCallback(name) {
        if (this._heartbeatPusher) {
            this._heartbeatPusher.disableCallback(name);
        }
    }

    getStats() {
        const stats = {
            running: this._running,
            config: { ...this._config }
        };

        if (this._threadPool) {
            stats.threadPool = this._threadPool.getStats();
        }

        if (this._taskQueue) {
            stats.taskQueue = this._taskQueue.getStats();
        }

        if (this._heartbeatPusher) {
            stats.heartbeat = this._heartbeatPusher.getStats();
        }

        return stats;
    }

    getTotalTicks() {
        if (this._heartbeatPusher) {
            return this._heartbeatPusher._totalTicks;
        }
        return 0;
    }

    getCurrentTime() {
        return Date.now();
    }

    getUptime() {
        if (this._heartbeatPusher && this._heartbeatPusher._startTime) {
            return (Date.now() - this._heartbeatPusher._startTime) / 1000;
        }
        return 0.0;
    }
}

let _heartbeatSystem = null;

function getHeartbeatSystem() {
    if (!_heartbeatSystem) {
        _heartbeatSystem = new HeartbeatSystem();
    }
    return _heartbeatSystem;
}

function initializeHeartbeatSystem() {
    const system = getHeartbeatSystem();

    logger.info('[Heartbeat] Initialized');
    logger.info('[Heartbeat] Use system.start() to begin operation');

    return system;
}

module.exports = {
    CallbackInfo,
    HeartbeatPusher,
    HeartbeatSystem,
    getHeartbeatSystem,
    initializeHeartbeatSystem
};
