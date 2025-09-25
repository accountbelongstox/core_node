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

const logger = require('#@logger');

class Scheduler {
    constructor(config = {}) {
        this.config = {
            checkInterval: 1000, // Default check interval: 1 second
            minGranularity: 1000, // Minimum time granularity: 1 second
            ...config
        };
        
        this.tasks = new Map();
        this.scheduledTasks = new Map();
        this.isRunning = false;
        this.checkTimer = null;
    }

    /**
     * Add an interval-based task
     * @param {string} id - Task identifier
     * @param {Function} callback - Task callback function
     * @param {number} interval - Execution interval in milliseconds
     * @param {Object} options - Additional options
     * @param {boolean} options.immediate - Whether to execute immediately
     * @param {number} options.delay - Initial execution delay
     */
    addIntervalTask(id, callback, interval, options = {
        firstRun: false
    }) {
        if (interval < this.config.minGranularity) {
            logger.warn(`Interval ${interval}ms is less than minimum granularity ${this.config.minGranularity}ms`);
            interval = this.config.minGranularity;
        }

        const task = {
            type: 'interval',
            callback,
            interval,
            lastRun: 0,
            ...options
        };

        this.tasks.set(id, task);
        logger.info(`Added interval task: ${id} with interval ${interval}ms`);
        this.start()
    }

    /**
     * Add a scheduled task
     * @param {string} id - Task identifier
     * @param {Function} callback - Task callback function
     * @param {string|Date} time - Scheduled execution time
     */
    addScheduledTask(id, callback, time) {
        const scheduledTime = typeof time === 'string' ? new Date(time) : time;
        
        if (isNaN(scheduledTime.getTime())) {
            throw new Error(`Invalid time format for task ${id}`);
        }

        this.scheduledTasks.set(id, {
            type: 'scheduled',
            callback,
            scheduledTime,
            executed: false
        });

        logger.info(`Added scheduled task: ${id} for ${scheduledTime}`);
        this.start()
    }

    /**
     * Remove a task
     * @param {string} id - Task identifier
     */
    removeTask(id) {
        if (this.tasks.has(id)) {
            this.tasks.delete(id);
            logger.info(`Removed interval task: ${id}`);
        }
        if (this.scheduledTasks.has(id)) {
            this.scheduledTasks.delete(id);
            logger.info(`Removed scheduled task: ${id}`);
        }
    }

    /**
     * Check and execute tasks
     */
    checkTasks() {
        const now = Date.now();

        // Check interval tasks
        for (const [id, task] of this.tasks) {
            if ((now - task.lastRun >= task.interval) || task.firstRun) {
                try {
                    task.callback();
                    task.lastRun = now;
                    task.firstRun = false;
                } catch (error) {
                    logger.error(`Error executing interval task ${id}:`, error);
                }
            }
        }

        // Check scheduled tasks
        for (const [id, task] of this.scheduledTasks) {
            if (!task.executed && now >= task.scheduledTime.getTime()) {
                try {
                    task.callback();
                    task.executed = true;
                    logger.info(`Executed scheduled task: ${id}`);
                } catch (error) {
                    logger.error(`Error executing scheduled task ${id}:`, error);
                }
            }
        }
    }

    /**
     * Start the scheduler
     */
    start() {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;
        this.checkTimer = setInterval(() => this.checkTasks(), this.config.checkInterval);
        logger.info('Scheduler started');
    }

    /**
     * Stop the scheduler
     */
    stop() {
        if (!this.isRunning) {
            logger.warn('Scheduler is not running');
            return;
        }

        clearInterval(this.checkTimer);
        this.isRunning = false;
        logger.info('Scheduler stopped');
    }

    /**
     * Get status of all tasks
     * @returns {Object} Task status information
     */
    getTaskStatus() {
        return {
            intervalTasks: Array.from(this.tasks.entries()).map(([id, task]) => ({
                id,
                type: task.type,
                interval: task.interval,
                lastRun: task.lastRun
            })),
            scheduledTasks: Array.from(this.scheduledTasks.entries()).map(([id, task]) => ({
                id,
                type: task.type,
                scheduledTime: task.scheduledTime,
                executed: task.executed
            }))
        };
    }

    /**
     * Clear all tasks
     */
    clearAllTasks() {
        this.tasks.clear();
        this.scheduledTasks.clear();
        logger.info('All tasks cleared');
    }

    /**
     * Pause a specific task
     * @param {string} id - Task identifier
     */
    pauseTask(id) {
        if (this.tasks.has(id)) {
            this.tasks.get(id).paused = true;
            logger.info(`Paused interval task: ${id}`);
        }
        if (this.scheduledTasks.has(id)) {
            this.scheduledTasks.get(id).paused = true;
            logger.info(`Paused scheduled task: ${id}`);
        }
    }

    /**
     * Resume a specific task
     * @param {string} id - Task identifier
     */
    resumeTask(id) {
        if (this.tasks.has(id)) {
            this.tasks.get(id).paused = false;
            logger.info(`Resumed interval task: ${id}`);
        }
        if (this.scheduledTasks.has(id)) {
            this.scheduledTasks.get(id).paused = false;
            logger.info(`Resumed scheduled task: ${id}`);
        }
    }
}

// Create and export a singleton instance
const scheduler = new Scheduler();
module.exports = scheduler;

