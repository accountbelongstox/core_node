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

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

// Fallback logger if not available
let logger;
try {
    logger = require('#@logger');
} catch (e) {
    logger = console;
}

class CompressionQueue extends EventEmitter {
    constructor() {
        super();
        this.tasks = new Map();
        this.pendingTasks = [];
        this.processingTasks = [];
        this.completedTasks = [];
        this.failedTasks = [];
        this.groupTasks = new Map();
        this.taskIdCounter = 1;
    }

    addTask(options) {
        const {
            type,
            sourcePath,
            archivePath,
            targetPath,
            sourceSize,
            priority = 'normal',
            groupId,
            forceOverwrite = false,
            singleFileCallback,
            compressionLevel = 'normal'
        } = options;

        if (!type || !['compression', 'extraction'].includes(type)) {
            throw new Error('Invalid task type. Must be "compression" or "extraction"');
        }

        if (type === 'compression' && !sourcePath) {
            throw new Error('sourcePath is required for compression tasks');
        }

        if (type === 'extraction' && !archivePath) {
            throw new Error('archivePath is required for extraction tasks');
        }

        const taskId = this.generateTaskId();
        const calculatedSourceSize = sourceSize || this.calculateSourceSize(sourcePath || archivePath);

        const task = {
            id: taskId,
            type,
            sourcePath: type === 'compression' ? sourcePath : undefined,
            archivePath: type === 'extraction' ? archivePath : undefined,
            targetPath,
            sourceSize: calculatedSourceSize,
            priority: this.normalizePriority(priority),
            groupId,
            forceOverwrite,
            singleFileCallback,
            compressionLevel,
            status: 'pending',
            createdAt: Date.now(),
            startTime: null,
            endTime: null,
            error: null,
            result: null
        };

        this.tasks.set(taskId, task);
        this.pendingTasks.push(task);

        if (groupId) {
            if (!this.groupTasks.has(groupId)) {
                this.groupTasks.set(groupId, []);
            }
            this.groupTasks.get(groupId).push(taskId);
        }

        this.sortPendingTasks();

        logger.info(`Added ${type} task: ${taskId} (${this.formatSize(calculatedSourceSize)})`);

        this.emit('taskAdded', task);

        return taskId;
    }

    removeTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            return false;
        }

        if (task.status === 'processing') {
            logger.warn(`Cannot remove task ${taskId}: currently processing`);
            return false;
        }

        this.tasks.delete(taskId);
        this.removeFromArray(this.pendingTasks, task);
        this.removeFromArray(this.completedTasks, task);
        this.removeFromArray(this.failedTasks, task);

        if (task.groupId) {
            const groupTasks = this.groupTasks.get(task.groupId);
            if (groupTasks) {
                const index = groupTasks.indexOf(taskId);
                if (index > -1) {
                    groupTasks.splice(index, 1);
                }
                if (groupTasks.length === 0) {
                    this.groupTasks.delete(task.groupId);
                }
            }
        }

        logger.info(`Removed task: ${taskId}`);
        this.emit('taskRemoved', taskId);

        return true;
    }

    getNextTasks(maxCount = 1, maxTotalSize = 100 * 1024 * 1024) {
        if (this.pendingTasks.length === 0) {
            return [];
        }

        const selectedTasks = [];
        let totalSize = 0;

        for (const task of this.pendingTasks) {
            if (selectedTasks.length >= maxCount) {
                break;
            }

            if (totalSize + task.sourceSize <= maxTotalSize) {
                selectedTasks.push(task);
                totalSize += task.sourceSize;
            } else if (selectedTasks.length === 0) {
                selectedTasks.push(task);
                break;
            } else {
                break;
            }
        }

        return selectedTasks;
    }

    startTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task || task.status !== 'pending') {
            return false;
        }

        task.status = 'processing';
        task.startTime = Date.now();

        this.removeFromArray(this.pendingTasks, task);
        this.processingTasks.push(task);

        this.emit('taskStarted', task);
        return true;
    }

    completeTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task || task.status !== 'processing') {
            return false;
        }

        task.status = 'completed';
        task.endTime = Date.now();

        this.removeFromArray(this.processingTasks, task);
        this.completedTasks.push(task);

        logger.success(`Task completed: ${taskId} (${task.endTime - task.startTime}ms)`);

        this.emit('taskCompleted', task);
        this.checkGroupCompletion(task.groupId);

        return true;
    }

    failTask(taskId, error) {
        const task = this.tasks.get(taskId);
        if (!task || task.status !== 'processing') {
            return false;
        }

        task.status = 'failed';
        task.endTime = Date.now();
        task.error = error;

        this.removeFromArray(this.processingTasks, task);
        this.failedTasks.push(task);

        logger.error(`Task failed: ${taskId} - ${error.message}`);

        this.emit('taskFailed', task);
        this.checkGroupCompletion(task.groupId);

        return true;
    }

    checkGroupCompletion(groupId) {
        if (!groupId) {
            return;
        }

        const groupTaskIds = this.groupTasks.get(groupId);
        if (!groupTaskIds) {
            return;
        }

        const allCompleted = groupTaskIds.every(taskId => {
            const task = this.tasks.get(taskId);
            return task && (task.status === 'completed' || task.status === 'failed');
        });

        if (allCompleted) {
            logger.info(`Group completed: ${groupId}`);
            this.emit('groupCompleted', groupId);
        }
    }

    hasTask() {
        return this.pendingTasks.length > 0 || this.processingTasks.length > 0;
    }

    getTasks() {
        return Array.from(this.tasks.values());
    }

    getStatus() {
        return {
            pending: this.pendingTasks.length,
            processing: this.processingTasks.length,
            completed: this.completedTasks.length,
            failed: this.failedTasks.length,
            total: this.tasks.size,
            groups: this.groupTasks.size
        };
    }

    clear() {
        const processingCount = this.processingTasks.length;
        if (processingCount > 0) {
            logger.warn(`Cannot clear queue: ${processingCount} tasks are currently processing`);
            return false;
        }

        this.tasks.clear();
        this.pendingTasks = [];
        this.completedTasks = [];
        this.failedTasks = [];
        this.groupTasks.clear();

        logger.info('Queue cleared');
        this.emit('queueCleared');

        return true;
    }

    generateTaskId() {
        return `task_${this.taskIdCounter++}_${Date.now()}`;
    }

    calculateSourceSize(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                return 0;
            }

            const stats = fs.statSync(filePath);
            if (stats.isFile()) {
                return stats.size;
            } else if (stats.isDirectory()) {
                return this.getDirectorySize(filePath);
            }
        } catch (error) {
            logger.warn(`Failed to calculate size for: ${filePath}`);
            return 0;
        }
        return 0;
    }

    getDirectorySize(dirPath) {
        let totalSize = 0;
        try {
            const items = fs.readdirSync(dirPath);
            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const stats = fs.statSync(itemPath);
                if (stats.isFile()) {
                    totalSize += stats.size;
                } else if (stats.isDirectory()) {
                    totalSize += this.getDirectorySize(itemPath);
                }
            }
        } catch (error) {
            logger.warn(`Failed to calculate directory size: ${dirPath}`);
        }
        return totalSize;
    }

    normalizePriority(priority) {
        const priorities = {
            'low': 1,
            'normal': 2,
            'high': 3,
            'urgent': 4
        };
        return priorities[priority] || 2;
    }

    sortPendingTasks() {
        this.pendingTasks.sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority - a.priority;
            }
            return a.createdAt - b.createdAt;
        });
    }

    removeFromArray(array, item) {
        const index = array.indexOf(item);
        if (index > -1) {
            array.splice(index, 1);
        }
    }

    formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }
}

module.exports = CompressionQueue;
