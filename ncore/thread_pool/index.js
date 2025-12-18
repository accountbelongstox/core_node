/**
 * NCore Thread Pool - Unified Thread Management
 *
 * Centralized thread pool and service registry for all NCore services.
 * 1:1 port from pycore/pythreadpool.
 *
 * Architecture:
 * - registry.js: Unified thread registry (metadata + starters)
 * - starters.js: Service starter functions
 * - pool.js: GlobalThreadPool implementation
 *
 * Public API:
 *   ThreadStatus           - Thread status enum
 *   ThreadInfo             - Thread information class
 *   GlobalThreadPool       - Thread pool manager
 *   getGlobalThreadPool    - Singleton accessor
 *   THREAD_REGISTRY        - Service metadata registry
 *   SERVICE_STARTERS       - Service starter function registry
 *
 * Usage:
 *   const { getGlobalThreadPool, startRpcV2 } = require('#@ncore/thread_pool');
 *
 *   const pool = getGlobalThreadPool();
 *   const instance = startRpcV2({ port: 58100 });
 */

const {
    ThreadStatus,
    ThreadInfo,
    GlobalThreadPool,
    getGlobalThreadPool,
    getThreadPoolFromEncyclopedia,
    THREAD_POOL_THREADS_KEY,
    THREAD_POOL_TASK_HANDLERS_KEY
} = require('./pool');

const {
    THREAD_REGISTRY,
    SERVICE_STARTERS,
    registerService
} = require('./registry');

const {
    startHeartbeat,
    startRpcV2,
    startSpeech,
    startUi,
    startElectronUI,
    startTray
} = require('./starters');

module.exports = {
    ThreadStatus,
    ThreadInfo,
    GlobalThreadPool,
    getGlobalThreadPool,
    getThreadPoolFromEncyclopedia,
    THREAD_POOL_THREADS_KEY,
    THREAD_POOL_TASK_HANDLERS_KEY,
    THREAD_REGISTRY,
    SERVICE_STARTERS,
    registerService,
    startHeartbeat,
    startRpcV2,
    startSpeech,
    startUi,
    startElectronUI,
    startTray
};
