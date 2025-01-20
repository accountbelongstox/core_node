const fs = require('fs');
const logger = require('#@logger');
const { compress, extractFile, calculateSize, formatSize } = require('./zutils');
const state = require('./constants');

/**
 * Check if a new task can be started
 * @param {number} itemSize - Size of the item to process
 * @returns {boolean} Whether the task can be started
 */
function canStartNewTask(itemSize) {
    if (!state.isMultiProcessEnabled()) {
        return state.getActiveProcesses() === 0;
    }

    // If it's a single large file exceeding the limit
    if (itemSize > state.getMaxProcessingSize()) {
        return state.getActiveProcesses() === 0; // Allow only if no other tasks are running
    }

    // For normal cases, check both size limit and process limit
    return state.getActiveProcesses() < state.getMaxConcurrentProcesses() && 
           (state.getCurrentProcessingSize() + itemSize <= state.getMaxProcessingSize() || 
            state.getActiveProcesses() === 0);
}

/**
 * Process compression task
 * @private
 */
async function compressTask(task) {
    const { sourcePath, targetPath, options } = task;
    logger.info(`Starting compression: ${sourcePath} -> ${targetPath}`);

    const sourceSize = calculateSize(sourcePath);
    try {
        // Track source size
        state.addProcessingSize(sourceSize);

        await compress(sourcePath, targetPath);
        logger.success(`Compression completed: ${targetPath}`);

        if (options.removeSource) {
            if (fs.statSync(sourcePath).isDirectory()) {
                fs.rmdirSync(sourcePath, { recursive: true });
            } else {
                fs.unlinkSync(sourcePath);
            }
            logger.info(`Removed source: ${sourcePath}`);
        }

        // Update processing size
        state.removeProcessingSize(sourceSize);
    } catch (error) {
        // Update processing size even if task failed
        state.removeProcessingSize(sourceSize);
        logger.error(`Compression failed for ${sourcePath}:`, error);
        throw error;
    }
}

/**
 * Process extraction task
 * @private
 */
async function extractTask(task) {
    const { zipPath, targetPath, options } = task;
    logger.info(`Starting extraction: ${zipPath} -> ${targetPath}`);

    const zipSize = calculateSize(zipPath);
    try {
        // Track zip file size
        state.addProcessingSize(zipSize);

        await extractFile(zipPath, targetPath);
        logger.success(`Extraction completed: ${targetPath}`);

        if (options.removeZip) {
            fs.unlinkSync(zipPath);
            logger.info(`Removed zip file: ${zipPath}`);
        }

        // Update processing size
        state.removeProcessingSize(zipSize);
    } catch (error) {
        // Update processing size even if task failed
        state.removeProcessingSize(zipSize);
        logger.error(`Extraction failed for ${zipPath}:`, error);
        throw error;
    }
}

/**
 * Check if all tasks in a group are completed
 * @param {string} groupName - Name of the group to check
 */
function checkGroupCompletion(groupName) {
    const remainingTasks = state.getQueue().filter(task => task.groupName === groupName);
    const activeTasks = state.getActiveTasksForGroup(groupName);

    if (remainingTasks.length === 0 && activeTasks.length === 0) {
        const group = state.getGroup(groupName);
        if (group && typeof group.callback === 'function') {
            group.callback();
            state.removeGroup(groupName);
        }
    }
}

/**
 * Process a single task
 * @param {Object} task - Task to process
 * @param {string} taskId - Unique task identifier
 * @private
 */
async function processTask(task, taskId) {
    const taskStartTime = Date.now();
    state.setCurrentTask(task);

    try {
        if (task.type === 'compress') {
            await compressTask(task);
        } else if (task.type === 'extract') {
            await extractTask(task);
        }

        // Execute task callback if provided
        if (typeof task.callback === 'function') {
            task.callback(true, null);
        }

        // Check group completion
        if (task.groupName) {
            checkGroupCompletion(task.groupName);
        }
    } catch (error) {
        // Execute task callback with error if provided
        if (typeof task.callback === 'function') {
            task.callback(false, error);
        }

        // Check group completion even on error
        if (task.groupName) {
            checkGroupCompletion(task.groupName);
        }
    } finally {
        // Clean up task resources
        const taskInfo = state.getActiveTask(taskId);
        if (taskInfo) {
            state.removeProcessingSize(taskInfo.size);
            state.removeActiveTask(taskId);
            state.decrementActiveProcesses();
        }
        state.setCurrentTask(null);

        // Continue processing queue if there are more tasks
        if (state.getQueueLength() > 0) {
            processQueue();
        }
    }
}

/**
 * Process tasks in queue
 * @private
 */
async function processQueue() {
    if (state.getQueueLength() === 0) {
        return;
    }

    state.setProcessing(true);

    try {
        // Process multiple tasks concurrently if enabled
        while (state.getQueueLength() > 0) {
            const task = state.getQueue()[0]; // Peek at the next task
            const itemSize = task.sourceSize || (task.type === 'compress' ? 
                calculateSize(task.sourcePath) : 
                calculateSize(task.zipPath));

            // if (!canStartNewTask(itemSize)) {
            //     // Wait for some tasks to complete
            //     await new Promise(resolve => setTimeout(resolve, 1000));
            //     continue;
            // }

            // Remove task from queue and process it
            state.removeFromQueue();
            const taskId = Date.now() + Math.random().toString(36).substr(2, 9);
            state.addActiveTask(taskId, task, itemSize);
            state.incrementActiveProcesses();

            // Process task asynchronously
            processTask(task, taskId).catch(error => {
                logger.error('Task processing error:', error);
            });
        }
    } catch (error) {
        logger.error('Error processing zip queue:', error);
    } finally {
        if (state.getQueueLength() === 0 && state.getActiveProcesses() === 0) {
            state.setProcessing(false);
            logger.info('All tasks completed');
        }
    }
}

module.exports = {
    processQueue,
    processTask,
    compressTask,
    extractTask,
    checkGroupCompletion,
    canStartNewTask
}; 