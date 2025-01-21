const { Worker, isMainThread, parentPort } = require('worker_threads');
const path = require('path');
const logger = require('#@logger');
const { formatDurationToStr } = require('../libs/datetool');

// Store active timers and manage namespaces
const activeTimers = new Map();
let namespaceCounter = 0;

/**
 * Generate a unique namespace for timer
 * @returns {string} Unique namespace
 */
function generateUniqueNamespace() {
    const timestamp = Date.now();
    const uniqueId = namespaceCounter++;
    // return `timer_${timestamp}_${uniqueId}`;
    return `timer_${uniqueId}`;
}

class TimerController {
    constructor(namespace) {
        this.worker = null;
        this.startTime = null;
        this.namespace = namespace;
    }

    start() {
        if (this.worker) {
            logger.warn(`Timer [${this.namespace}] is already running`);
            return;
        }

        const workerPath = __filename;
        this.worker = new Worker(workerPath);
        this.startTime = Date.now();

        // Handle worker messages
        this.worker.on('message', (message) => {
            if (message.type === 'timerLog') {
                logger.info(`\n[${this.namespace}] ${message.content}`);
            } else if (message.type === 'timerProgress') {
                logger.progressBar(message.current, message.total, {
                    format: `[${this.namespace}] Timer: [{bar}] {percentage}% | {current}s/{total}s | Duration: ${message.duration}`
                });
            }
        });

        // Handle worker errors
        this.worker.on('error', (error) => {
            logger.error(`Timer [${this.namespace}] worker error:`, error);
            this.stop();
        });

        // Handle worker exit
        this.worker.on('exit', (code) => {
            if (code !== 0) {
                logger.warn(`Timer [${this.namespace}] worker stopped with exit code ${code}`);
            }
            this.worker = null;
            this.startTime = null;
            // Auto cleanup from active timers on unexpected exit
            if (activeTimers.has(this.namespace)) {
                activeTimers.delete(this.namespace);
            }
        });

        // Start the timer in worker thread
        this.worker.postMessage({ type: 'start', namespace: this.namespace });
        logger.info(`Timer [${this.namespace}] worker started`);
    }

    stop() {
        if (!this.worker) {
            logger.warn(`No timer [${this.namespace}] is running`);
            return;
        }

        this.worker.postMessage({ type: 'stop' });
        this.worker.terminate();
        this.worker = null;
        this.startTime = null;
        logger.info(`[${this.namespace}] Timer stopped, Duration: ${formatDurationToStr(Date.now() - this.startTime)}`);
    }
}

// Worker thread code
if (!isMainThread) {
    let intervalId = null;
    let cycleCount = 0;
    let workerNamespace = '';
    const startTime = Date.now();

    parentPort.on('message', (message) => {
        if (message.type === 'start') {
            workerNamespace = message.namespace;
            if (!intervalId) {
                // Start interval timer
                intervalId = setInterval(() => {
                    const duration = Date.now() - startTime;
                    const seconds = Math.floor(duration / 1000);
                    const currentCycleSeconds = seconds % 60;

                    // Send progress message
                    parentPort.postMessage({
                        type: 'timerProgress',
                        current: currentCycleSeconds,
                        total: 60,
                        duration: formatDurationToStr(duration)
                    });

                    // If we completed a cycle (60 seconds)
                    if (currentCycleSeconds === 0 && seconds > 0) {
                        cycleCount++;
                        parentPort.postMessage({
                            type: 'timerLog',
                            content: `Completed ${cycleCount} minute${cycleCount > 1 ? 's' : ''} (${formatDurationToStr(duration)})`
                        });
                    }
                }, 1000);
            }
        } else if (message.type === 'stop') {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        }
    });
}

/**
 * Generate a new worker timer with auto-generated namespace
 * @returns {Object} Timer control object with namespace and stop method
 */
function generateWorkerTimer() {
    const namespace = generateUniqueNamespace();
    const controller = new TimerController(namespace);

    const timerControl = {
        namespace,  // Expose namespace for reference
        stopTimer: () => {
            controller.stop();
            activeTimers.delete(namespace);
        }
    };

    activeTimers.set(namespace, timerControl);
    controller.start();
    return timerControl;
}

/**
 * Get all active timer namespaces
 * @returns {string[]} List of active timer namespaces
 */
function getActiveTimers() {
    return Array.from(activeTimers.keys());
}

module.exports = {
    generateWorkerTimer,
    getActiveTimers
};