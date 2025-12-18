/**
 * Global Task Models
 *
 * Foundation classes for task-based scheduling system.
 * Tasks are processed by HeartbeatSystem's task queue processor.
 *
 * Features:
 * - Task state management (pending/running/completed/failed/cancelled)
 * - Priority levels (urgent/critical/high/normal/low)
 * - Retry mechanism
 * - Callback support
 *
 * Usage:
 *   const { Task, TaskState, TaskPriority } = require('#@foundation/task_models');
 *
 *   const task = new Task('tts', { text: 'Hello' }, {
 *       priority: TaskPriority.HIGH,
 *       maxRetries: 3
 *   });
 */

const { v4: uuidv4 } = require('uuid');

const TaskState = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};

const TaskPriority = {
    URGENT: 0,
    CRITICAL: 1,
    HIGH: 2,
    NORMAL: 3,
    LOW: 4
};

class Task {
    constructor(taskType, taskData, options = {}) {
        this.taskType = taskType;
        this.taskData = taskData;
        this.priority = options.priority !== undefined ? options.priority : TaskPriority.NORMAL;
        this.taskId = options.taskId || uuidv4();
        this.state = options.state || TaskState.PENDING;
        this.createdAt = Date.now();
        this.startedAt = null;
        this.completedAt = null;
        this.error = null;
        this.retryCount = 0;
        this.maxRetries = options.maxRetries !== undefined ? options.maxRetries : 3;
        this.callback = options.callback || null;
        this.errorCallback = options.errorCallback || null;
        this.metadata = options.metadata || {};
    }

    markRunning() {
        this.state = TaskState.RUNNING;
        this.startedAt = Date.now();
    }

    markCompleted() {
        this.state = TaskState.COMPLETED;
        this.completedAt = Date.now();
    }

    markFailed(error) {
        this.state = TaskState.FAILED;
        this.error = error;
        this.completedAt = Date.now();
    }

    markCancelled() {
        this.state = TaskState.CANCELLED;
        this.completedAt = Date.now();
    }

    canRetry() {
        return this.retryCount < this.maxRetries;
    }

    incrementRetry() {
        this.retryCount++;
        this.state = TaskState.PENDING;
        this.startedAt = null;
        this.error = null;
    }

    getDuration() {
        if (this.startedAt && this.completedAt) {
            return (this.completedAt - this.startedAt) / 1000;
        }
        return null;
    }

    toDict() {
        return {
            taskId: this.taskId,
            taskType: this.taskType,
            state: this.state,
            priority: this.priority,
            createdAt: this.createdAt,
            startedAt: this.startedAt,
            completedAt: this.completedAt,
            error: this.error,
            retryCount: this.retryCount,
            maxRetries: this.maxRetries,
            duration: this.getDuration(),
            metadata: this.metadata
        };
    }
}

module.exports = {
    Task,
    TaskState,
    TaskPriority
};
