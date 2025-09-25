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

const SmartCompressionManager = require('./libs/smart_compression_manager');
const CompressionQueue = require('./libs/compression_queue');
const SystemMonitor = require('./libs/system_monitor');
const CompressionScheduler = require('./libs/compression_scheduler');
const SmartCompressionConfig = require('./config');

class SmartCompression {
    constructor(options = {}) {
        this.config = new SmartCompressionConfig();

        if (options.config) {
            this.config.update(options.config);
        }

        this.manager = new SmartCompressionManager();
        this.queue = new CompressionQueue();
        this.monitor = new SystemMonitor();
        this.scheduler = new CompressionScheduler(this.queue, this.monitor);

        this.isProcessing = false;
        this.groupCallbacks = new Map();

        this.applyConfiguration();
        this.setupEventHandlers();
    }

    applyConfiguration() {
        const config = this.config.current;
        this.scheduler.setMaxParallelSize(config.maxParallelSize);
        this.scheduler.setMaxParallelTasks(config.maxParallelTasks);
        this.scheduler.setLargeFileThreshold(config.largeFileThreshold);
        this.scheduler.setCPUThreshold(config.cpuThreshold);
        this.scheduler.setMemoryThreshold(config.memoryThreshold);
    }

    setupEventHandlers() {
        this.queue.on('taskAdded', () => {
            if (!this.isProcessing) {
                this.startProcessing();
            }
        });

        this.queue.on('groupCompleted', (groupId) => {
            const callback = this.groupCallbacks.get(groupId);
            if (callback && typeof callback === 'function') {
                callback(groupId);
                this.groupCallbacks.delete(groupId);
            }
        });
    }

    addCompressionTask(options) {
        const {
            sourcePath,
            targetPath,
            sourceSize,
            priority = 'normal',
            groupId,
            forceOverwrite = false,
            singleFileCallback,
            compressionLevel = 'normal'
        } = options;

        return this.queue.addTask({
            type: 'compression',
            sourcePath,
            targetPath,
            sourceSize,
            priority,
            groupId,
            forceOverwrite,
            singleFileCallback,
            compressionLevel
        });
    }

    addExtractionTask(options) {
        const {
            archivePath,
            targetPath,
            sourceSize,
            priority = 'normal',
            groupId,
            forceOverwrite = false,
            singleFileCallback
        } = options;

        return this.queue.addTask({
            type: 'extraction',
            archivePath,
            targetPath,
            sourceSize,
            priority,
            groupId,
            forceOverwrite,
            singleFileCallback
        });
    }

    setGroupCallback(groupId, callback) {
        this.groupCallbacks.set(groupId, callback);
    }

    async startProcessing() {
        if (this.isProcessing) {
            return;
        }

        this.isProcessing = true;

        try {
            while (this.queue.hasTask()) {
                const executionPlan = await this.scheduler.createExecutionPlan();

                if (executionPlan.tasks.length === 0) {
                    await this.sleep(1000);
                    continue;
                }

                await this.executeTaskBatch(executionPlan);
            }
        } finally {
            this.isProcessing = false;
        }
    }

    async executeTaskBatch(executionPlan) {
        const { tasks, mode } = executionPlan;

        if (mode === 'parallel') {
            const promises = tasks.map(task => this.executeTask(task));
            await Promise.all(promises);
        } else {
            for (const task of tasks) {
                await this.executeTask(task);
            }
        }
    }

    async executeTask(task) {
        try {
            task.status = 'processing';
            task.startTime = Date.now();

            let result;
            if (task.type === 'compression') {
                result = await this.manager.compressFile(task);
            } else if (task.type === 'extraction') {
                result = await this.manager.extractFile(task);
            }

            task.status = 'completed';
            task.endTime = Date.now();
            task.result = result;

            if (task.singleFileCallback && typeof task.singleFileCallback === 'function') {
                task.singleFileCallback(true, result, task);
            }

            this.queue.completeTask(task.id);

        } catch (error) {
            task.status = 'failed';
            task.endTime = Date.now();
            task.error = error;

            if (task.singleFileCallback && typeof task.singleFileCallback === 'function') {
                task.singleFileCallback(false, error, task);
            }

            this.queue.failTask(task.id, error);
        }
    }

    getQueueStatus() {
        return this.queue.getStatus();
    }

    getQueueTasks() {
        return this.queue.getTasks();
    }

    removeTask(taskId) {
        return this.queue.removeTask(taskId);
    }

    clearQueue() {
        return this.queue.clear();
    }

    getSystemStatus() {
        return this.monitor.getStatus();
    }

    setMaxParallelSize(sizeInMB) {
        this.scheduler.setMaxParallelSize(sizeInMB * 1024 * 1024);
    }

    setMaxParallelTasks(count) {
        this.scheduler.setMaxParallelTasks(count);
        this.config.set('maxParallelTasks', count);
    }

    getConfiguration() {
        return this.config.exportConfiguration();
    }

    updateConfiguration(newConfig) {
        this.config.update(newConfig);
        this.applyConfiguration();
    }

    resetConfiguration() {
        this.config.reset();
        this.applyConfiguration();
    }

    getSystemRecommendations() {
        return this.config.getSystemRecommendations();
    }

    validateConfiguration() {
        return this.config.validateConfiguration();
    }

    getSchedulingRecommendations() {
        return this.scheduler.getSchedulingRecommendations();
    }

    getFileSizeCategory(sizeInBytes) {
        return this.config.getFileSizeCategory(sizeInBytes);
    }

    getProcessingStrategy(sizeInBytes) {
        return this.config.getProcessingStrategy(sizeInBytes);
    }

    destroy() {
        this.monitor.destroy();
        this.clearQueue();
        this.groupCallbacks.clear();
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = SmartCompression;
