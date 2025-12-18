/**
 * Global Task Queue
 *
 * Thread-safe priority queue for global task scheduling.
 * Used by HeartbeatSystem to dispatch tasks to registered handlers.
 *
 * Features:
 * - Priority queue (lower priority value = higher precedence)
 * - Thread-safe operations
 * - Task state tracking
 * - Cleanup utilities
 *
 * Usage:
 *   const { getGlobalTaskQueue } = require('#@foundation/task_queue');
 *   const queue = getGlobalTaskQueue();
 *
 *   await queue.put(task);
 *   const nextTask = await queue.get();
 */

const { Task, TaskState, TaskPriority } = require('./task_models');

class PriorityQueue {
    constructor() {
        this.items = [];
    }

    enqueue(priority, timestamp, item) {
        const element = { priority, timestamp, item };
        let added = false;

        for (let i = 0; i < this.items.length; i++) {
            if (element.priority < this.items[i].priority ||
                (element.priority === this.items[i].priority && element.timestamp < this.items[i].timestamp)) {
                this.items.splice(i, 0, element);
                added = true;
                break;
            }
        }

        if (!added) {
            this.items.push(element);
        }
    }

    dequeue() {
        if (this.items.length === 0) {
            return null;
        }
        return this.items.shift().item;
    }

    isEmpty() {
        return this.items.length === 0;
    }

    size() {
        return this.items.length;
    }

    isFull(maxSize) {
        return this.items.length >= maxSize;
    }
}

class GlobalTaskQueue {
    constructor(maxSize = 10000) {
        this._queue = new PriorityQueue();
        this._taskMap = new Map();
        this._maxSize = maxSize;
        this._totalAdded = 0;
        this._totalRemoved = 0;
        this._lock = false;
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

    async put(task, block = true, timeout = null) {
        await this._acquireLock();

        try {
            if (this._queue.isFull(this._maxSize)) {
                if (!block) {
                    throw new Error('Queue is full');
                }
                this._releaseLock();
                return false;
            }

            this._queue.enqueue(task.priority, task.createdAt, task);
            this._taskMap.set(task.taskId, task);
            this._totalAdded++;

            return true;

        } finally {
            if (this._lock) {
                this._releaseLock();
            }
        }
    }

    async get(block = true, timeout = null) {
        if (this._queue.isEmpty()) {
            return null;
        }

        const task = this._queue.dequeue();
        if (task) {
            this._totalRemoved++;
            return task;
        }

        return null;
    }

    async remove(taskId) {
        await this._acquireLock();

        try {
            const task = this._taskMap.get(taskId);
            if (task && task.state === TaskState.PENDING) {
                task.markCancelled();
                return true;
            }
            return false;

        } finally {
            this._releaseLock();
        }
    }

    getTask(taskId) {
        return this._taskMap.get(taskId) || null;
    }

    async cleanupCompleted(maxKeep = 1000) {
        await this._acquireLock();

        try {
            const completedTasks = [];

            for (const [taskId, task] of this._taskMap.entries()) {
                if ([TaskState.COMPLETED, TaskState.FAILED, TaskState.CANCELLED].includes(task.state)) {
                    completedTasks.push({ taskId, task });
                }
            }

            if (completedTasks.length > maxKeep) {
                completedTasks.sort((a, b) => (a.task.completedAt || 0) - (b.task.completedAt || 0));
                const toRemove = completedTasks.slice(0, completedTasks.length - maxKeep);

                for (const { taskId } of toRemove) {
                    this._taskMap.delete(taskId);
                }
            }

        } finally {
            this._releaseLock();
        }
    }

    size() {
        return this._queue.size();
    }

    isEmpty() {
        return this._queue.isEmpty();
    }

    isFull() {
        return this._queue.isFull(this._maxSize);
    }

    getStats() {
        const stateCounts = {};

        for (const task of this._taskMap.values()) {
            const state = task.state;
            stateCounts[state] = (stateCounts[state] || 0) + 1;
        }

        return {
            queueSize: this.size(),
            totalTasks: this._taskMap.size,
            totalAdded: this._totalAdded,
            totalRemoved: this._totalRemoved,
            maxSize: this._maxSize,
            isFull: this.isFull(),
            stateCounts
        };
    }

    getPendingTasks() {
        const tasks = [];
        for (const task of this._taskMap.values()) {
            if (task.state === TaskState.PENDING) {
                tasks.push(task);
            }
        }
        return tasks;
    }

    getRunningTasks() {
        const tasks = [];
        for (const task of this._taskMap.values()) {
            if (task.state === TaskState.RUNNING) {
                tasks.push(task);
            }
        }
        return tasks;
    }

    clear() {
        this._queue = new PriorityQueue();
        this._taskMap.clear();
    }
}

let _globalTaskQueue = null;

function getGlobalTaskQueue() {
    if (!_globalTaskQueue) {
        _globalTaskQueue = new GlobalTaskQueue();
    }
    return _globalTaskQueue;
}

module.exports = {
    GlobalTaskQueue,
    getGlobalTaskQueue
};
