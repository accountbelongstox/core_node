/**
 * NCore Heartbeat - Unified Global Task Scheduler
 *
 * Simplified, unified heartbeat system for periodic task execution.
 * 1:1 port from pycore/pyheartbeat.
 *
 * Features:
 * - Ticks every 1 second (configurable)
 * - Callback registration with intervals
 * - Global task queue processing
 * - THREAD_BUS integration
 *
 * Public API:
 *   CallbackInfo             - Callback information class
 *   HeartbeatPusher          - Heartbeat tick generator
 *   HeartbeatSystem          - Main heartbeat coordinator
 *   getHeartbeatSystem       - Singleton accessor
 *   initializeHeartbeatSystem - Initialization function
 *
 * Usage:
 *   const { initializeHeartbeatSystem } = require('#@ncore/heartbeat');
 *
 *   const system = initializeHeartbeatSystem();
 *   system.start();
 *   system.registerCallback('my_task', callback, 30);
 *
 * Reference: PYHEARTBEAT_ARCHITECTURE.md
 */

const {
    CallbackInfo,
    HeartbeatPusher,
    HeartbeatSystem,
    getHeartbeatSystem,
    initializeHeartbeatSystem
} = require('./heartbeat');

const {
    ThreadStatus,
    ThreadInfo,
    GlobalThreadPool,
    getGlobalThreadPool,
    getThreadPoolFromEncyclopedia,
    THREAD_POOL_THREADS_KEY,
    THREAD_POOL_TASK_HANDLERS_KEY
} = require('#@ncore/thread_pool');

module.exports = {
    CallbackInfo,
    HeartbeatPusher,
    HeartbeatSystem,
    getHeartbeatSystem,
    initializeHeartbeatSystem,
    ThreadStatus,
    ThreadInfo,
    GlobalThreadPool,
    getGlobalThreadPool,
    getThreadPoolFromEncyclopedia,
    THREAD_POOL_THREADS_KEY,
    THREAD_POOL_TASK_HANDLERS_KEY
};
