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

// Fallback logger if not available
let logger;
try {
    logger = require('#@logger');
} catch (e) {
    logger = console;
}

class CompressionScheduler {
    constructor(queue, systemMonitor) {
        this.queue = queue;
        this.systemMonitor = systemMonitor;

        this.maxParallelSize = 100 * 1024 * 1024; // 100MB default
        this.maxParallelTasks = 4;
        this.largeFileThreshold = 50 * 1024 * 1024; // 50MB
        this.cpuThreshold = 75;
        this.memoryThreshold = 80;
    }

    async createExecutionPlan() {
        const systemStatus = this.systemMonitor.getStatus();
        const queueStatus = this.queue.getStatus();

        if (queueStatus.pending === 0) {
            return {
                tasks: [],
                mode: 'none',
                reason: 'No pending tasks'
            };
        }

        const isSystemUnderLoad = systemStatus.load.underLoad;
        const optimalParallelTasks = systemStatus.recommendations.optimalParallelTasks;

        if (isSystemUnderLoad) {
            logger.info('System under load, using serial processing');
            return this.createSerialPlan();
        }

        const availableTasks = this.queue.getNextTasks(
            Math.min(this.maxParallelTasks, optimalParallelTasks),
            this.maxParallelSize
        );

        if (availableTasks.length === 0) {
            return {
                tasks: [],
                mode: 'none',
                reason: 'No suitable tasks available'
            };
        }

        if (availableTasks.length === 1) {
            const task = availableTasks[0];
            if (task.sourceSize > this.largeFileThreshold) {
                logger.info(`Large file detected (${this.formatSize(task.sourceSize)}), using serial processing`);
                return this.createSerialPlan();
            }
        }

        const totalSize = availableTasks.reduce((sum, task) => sum + task.sourceSize, 0);

        if (totalSize > this.maxParallelSize) {
            logger.info(`Total size exceeds parallel limit (${this.formatSize(totalSize)}), using serial processing`);
            return this.createSerialPlan();
        }

        const hasLargeFiles = availableTasks.some(task => task.sourceSize > this.largeFileThreshold);
        if (hasLargeFiles) {
            logger.info('Large files detected in batch, using serial processing');
            return this.createSerialPlan();
        }

        logger.info(`Using parallel processing for ${availableTasks.length} tasks (${this.formatSize(totalSize)})`);
        return this.createParallelPlan(availableTasks);
    }

    createSerialPlan() {
        const nextTask = this.queue.getNextTasks(1, Infinity);

        if (nextTask.length === 0) {
            return {
                tasks: [],
                mode: 'none',
                reason: 'No tasks available'
            };
        }

        this.queue.startTask(nextTask[0].id);

        return {
            tasks: nextTask,
            mode: 'serial',
            reason: 'Serial processing for optimal system performance'
        };
    }

    createParallelPlan(tasks) {
        const systemStatus = this.systemMonitor.getStatus();
        const maxConcurrent = Math.min(
            tasks.length,
            systemStatus.recommendations.optimalParallelTasks,
            this.maxParallelTasks
        );

        const selectedTasks = tasks.slice(0, maxConcurrent);

        selectedTasks.forEach(task => {
            this.queue.startTask(task.id);
        });

        return {
            tasks: selectedTasks,
            mode: 'parallel',
            reason: `Parallel processing with ${selectedTasks.length} concurrent tasks`
        };
    }

    shouldUseParallelProcessing(tasks) {
        if (tasks.length <= 1) {
            return false;
        }

        const systemStatus = this.systemMonitor.getStatus();
        if (systemStatus.load.underLoad) {
            return false;
        }

        const totalSize = tasks.reduce((sum, task) => sum + task.sourceSize, 0);
        if (totalSize > this.maxParallelSize) {
            return false;
        }

        const hasLargeFiles = tasks.some(task => task.sourceSize > this.largeFileThreshold);
        if (hasLargeFiles) {
            return false;
        }

        return true;
    }

    optimizeTaskOrder(tasks) {
        return tasks.sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority - a.priority;
            }

            if (a.sourceSize !== b.sourceSize) {
                return a.sourceSize - b.sourceSize;
            }

            return a.createdAt - b.createdAt;
        });
    }

    estimateTaskDuration(task) {
        const baseTimePerMB = task.type === 'compression' ? 2000 : 1000; // milliseconds
        const sizeInMB = task.sourceSize / (1024 * 1024);
        const estimatedTime = Math.max(1000, sizeInMB * baseTimePerMB);

        const systemLoad = this.systemMonitor.isSystemUnderLoad();
        if (systemLoad.underLoad) {
            return estimatedTime * 1.5;
        }

        return estimatedTime;
    }

    getSchedulingRecommendations() {
        const systemStatus = this.systemMonitor.getStatus();
        const queueStatus = this.queue.getStatus();

        const recommendations = {
            currentMode: 'unknown',
            suggestedMode: 'serial',
            maxParallelTasks: systemStatus.recommendations.optimalParallelTasks,
            systemLoad: systemStatus.load,
            queueStatus,
            suggestions: []
        };

        if (systemStatus.load.underLoad) {
            recommendations.suggestedMode = 'serial';
            recommendations.suggestions.push('System under load - use serial processing');
        } else if (queueStatus.pending > 0) {
            const nextTasks = this.queue.getNextTasks(this.maxParallelTasks, this.maxParallelSize);
            const totalSize = nextTasks.reduce((sum, task) => sum + task.sourceSize, 0);

            if (totalSize <= this.maxParallelSize && nextTasks.length > 1) {
                const hasLargeFiles = nextTasks.some(task => task.sourceSize > this.largeFileThreshold);
                if (!hasLargeFiles) {
                    recommendations.suggestedMode = 'parallel';
                    recommendations.suggestions.push(`Can process ${nextTasks.length} tasks in parallel`);
                } else {
                    recommendations.suggestions.push('Large files detected - use serial processing');
                }
            } else {
                recommendations.suggestions.push('Tasks too large for parallel processing');
            }
        }

        if (systemStatus.cpu.current > this.cpuThreshold) {
            recommendations.suggestions.push(`High CPU usage (${systemStatus.cpu.current}%) - consider reducing parallel tasks`);
        }

        if (systemStatus.memory.percentage > this.memoryThreshold) {
            recommendations.suggestions.push(`High memory usage (${systemStatus.memory.percentage}%) - use serial processing`);
        }

        return recommendations;
    }

    setMaxParallelSize(sizeInBytes) {
        this.maxParallelSize = sizeInBytes;
        logger.info(`Max parallel size set to: ${this.formatSize(sizeInBytes)}`);
    }

    setMaxParallelTasks(count) {
        this.maxParallelTasks = Math.max(1, count);
        logger.info(`Max parallel tasks set to: ${this.maxParallelTasks}`);
    }

    setLargeFileThreshold(sizeInBytes) {
        this.largeFileThreshold = sizeInBytes;
        logger.info(`Large file threshold set to: ${this.formatSize(sizeInBytes)}`);
    }

    setCPUThreshold(percentage) {
        this.cpuThreshold = Math.max(0, Math.min(100, percentage));
        logger.info(`CPU threshold set to: ${this.cpuThreshold}%`);
    }

    setMemoryThreshold(percentage) {
        this.memoryThreshold = Math.max(0, Math.min(100, percentage));
        logger.info(`Memory threshold set to: ${this.memoryThreshold}%`);
    }

    getConfiguration() {
        return {
            maxParallelSize: this.maxParallelSize,
            maxParallelTasks: this.maxParallelTasks,
            largeFileThreshold: this.largeFileThreshold,
            cpuThreshold: this.cpuThreshold,
            memoryThreshold: this.memoryThreshold,
            formatted: {
                maxParallelSize: this.formatSize(this.maxParallelSize),
                largeFileThreshold: this.formatSize(this.largeFileThreshold)
            }
        };
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

module.exports = CompressionScheduler;
