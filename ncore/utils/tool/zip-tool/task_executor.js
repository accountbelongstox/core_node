const fs = require('fs');
const logger = require('#@logger');
const { compress, extractFile, calculateSize, formatSize, formatTaskPaths } = require('./task_zutils');
const state = require('./task_constants');
const { formatDurationToStr } = require('../libs/datetool');
const printDebug = true;

/**
 * Debug logging with condition check
 * @param {string} message - Debug message to log
 */
function debugLog(message) {
    if (printDebug) {
        logger.debug(message);
    }
}

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
    const taskPath = task.type === 'compress' ? 
        formatTaskPaths(task.sourcePath, task.targetPath) :
        formatTaskPaths(task.zipPath, task.targetPath);
    const itemSize = task.sourceSize || (task.type === 'compress' ? 
        calculateSize(task.sourcePath) : 
        calculateSize(task.zipPath));

    // Step 0: Task setup
    debugLog(
        `[processTask:step0] Task setup - ${taskPath} (${formatSize(itemSize)}) - Initializing task processing`
    );

    // Step 1: Set current task
    state.setCurrentTask(task);
    debugLog(
        `[processTask:step1] Current task set - ${taskPath} (${formatSize(itemSize)}) - Task marked as current`
    );

    try {
        if (task.type === 'compress') {
            // Step 2a: Compression start
            debugLog(
                `[processTask:step2a] Compression start - ${taskPath} (${formatSize(itemSize)}) - Starting compression task`
            );
            await compressTask(task);
            // Step 3a: Compression complete
            debugLog(
                `[processTask:step3a] Compression complete - ${taskPath} (${formatSize(itemSize)}) - Compression task finished`
            );
        } else if (task.type === 'extract') {
            // Step 2b: Extraction start
            debugLog(
                `[processTask:step2b] Extraction start - ${taskPath} (${formatSize(itemSize)}) - Starting extraction task`
            );
            await extractTask(task);
            // Step 3b: Extraction complete
            debugLog(
                `[processTask:step3b] Extraction complete - ${taskPath} (${formatSize(itemSize)}) - Extraction task finished`
            );
        }

        // Execute task callback if provided
        if (typeof task.callback === 'function') {
            // Step 4: Success callback
            debugLog(
                `[processTask:step4] Success callback - ${taskPath} (${formatSize(itemSize)}) - Executing success callback`
            );
            task.callback(true, null);
        }

        // Check group completion
        if (task.groupName) {
            // Step 5: Group completion check
            debugLog(
                `[processTask:step5] Group check - ${taskPath} (${formatSize(itemSize)}) - Checking group completion: ${task.groupName}`
            );
            checkGroupCompletion(task.groupName);
        }
    } catch (error) {
        // Execute task callback with error if provided
        if (typeof task.callback === 'function') {
            // Step 6: Error callback
            debugLog(
                `[processTask:step6] Error callback - ${taskPath} (${formatSize(itemSize)}) - Executing error callback`
            );
            task.callback(false, error);
        }

        // Check group completion even on error
        if (task.groupName) {
            // Step 7: Group completion check on error
            debugLog(
                `[processTask:step7] Group error check - ${taskPath} (${formatSize(itemSize)}) - Checking group completion after error: ${task.groupName}`
            );
            checkGroupCompletion(task.groupName);
        }
    } finally {
        const taskDuration = Date.now() - taskStartTime;
        // Step 8: Cleanup start
        debugLog(
            `[processTask:step8] Cleanup start - ${taskPath} (${formatSize(itemSize)}) - Duration: ${formatDurationToStr(taskDuration)} - Starting cleanup process`
        );
        state.setProcessing(false);
        const taskInfo = state.getActiveTask(taskId);
        if (taskInfo) {
            // Step 9: Size cleanup
            debugLog(
                `[processTask:step9] Size cleanup - ${taskPath} (${formatSize(itemSize)}) - Removing processing size`
            );
            state.removeProcessingSize(taskInfo.size);

            // Step 10: Task cleanup
            debugLog(
                `[processTask:step10] Task cleanup - ${taskPath} (${formatSize(itemSize)}) - Removing active task`
            );
            state.removeActiveTask(taskId);

            // Step 11: Process count update
            debugLog(
                `[processTask:step11] Process update - ${taskPath} (${formatSize(itemSize)}) - Decrementing active processes`
            );
            state.decrementActiveProcesses();
        }

        // Step 12: Current task reset
        debugLog(
            `[processTask:step12] Task reset - ${taskPath} (${formatSize(itemSize)}) - Resetting current task`
        );
        state.setCurrentTask(null);

        // Step 13: Queue check with duration
        if (state.getQueueLength() > 0) {
            debugLog(
                `[processTask:step13] Queue check - ${taskPath} (${formatSize(itemSize)}) - Duration: ${formatDurationToStr(taskDuration)} - Processing remaining queue items: ${state.getQueueLength()} remaining`
            );
            processQueue();
        } else {
            debugLog(
                `[processTask:step13] Queue complete - ${taskPath} (${formatSize(itemSize)}) - Duration: ${formatDurationToStr(taskDuration)} - No more items in queue`
            );
        }
    }
}

/**
 * Process tasks in queue
 * @private
 */
async function processQueue() {
    if (state.getQueueLength() === 0) {
        state.setProcessing(false);
        return;
    }

    const queueStartTime = Date.now();

    if(state.isProcessing()){
        const message = `[processQueue] Queue processing already in progress - Tasks: ${state.getQueueLength()}, Active: ${state.getActiveProcesses()}, Size: ${formatSize(state.getCurrentProcessingSize())}`
        logger.limitedLog(
            message,
            10,
            `processQueue`,
            `gray`
        );
        return;
    }

    debugLog(
        `[processQueue] Starting queue processing - Tasks: ${state.getQueueLength()}, Active: ${state.getActiveProcesses()}, Size: ${formatSize(state.getCurrentProcessingSize())}`
    );
    
    state.setProcessing(true);

    try {
        while (state.getQueueLength() > 0) {
            const task = state.getQueue()[0]; // Peek at the next task
            const itemSize = task.sourceSize || (task.type === 'compress' ? 
                calculateSize(task.sourcePath) : 
                calculateSize(task.zipPath));
            const taskPath = task.type === 'compress' ? 
                formatTaskPaths(task.sourcePath, task.targetPath) :
                formatTaskPaths(task.zipPath, task.targetPath);
            
            // Step 1: Task initialization
            debugLog(
                `[processQueue:step1] Task initialization - ${taskPath} (${formatSize(itemSize)}) - Preparing to process next task in queue`
            );

            // Step 2: Remove from queue
            state.removeFromQueue();
            debugLog(
                `[processQueue:step2] Queue management - ${taskPath} (${formatSize(itemSize)}) - Task removed from queue`
            );

            // Step 3: Task ID assignment
            const taskId = Date.now() + Math.random().toString(36).substr(2, 9);
            state.addActiveTask(taskId, task, itemSize);
            debugLog(
                `[processQueue:step3] Task tracking - ${taskPath} (${formatSize(itemSize)}) - Task assigned ID: ${taskId}`
            );

            // Step 4: Process activation
            state.incrementActiveProcesses();
            debugLog(
                `[processQueue:step4] Process activation - ${taskPath} (${formatSize(itemSize)}) - Active processes: ${state.getActiveProcesses()}`
            );

            // Step 5: Task execution
            debugLog(
                `[processQueue:step5] Task execution - ${taskPath} (${formatSize(itemSize)}) - Starting asynchronous processing`
            );

            await processTask(task, taskId).catch(error => {
                logger.error('Task processing error:', error);
            });
        }
    } catch (error) {
        logger.error('Error processing zip queue:', error);
    } finally {
        const queueDuration = Date.now() - queueStartTime;
        if (state.getQueueLength() === 0 && state.getActiveProcesses() === 0) {
            // Step 6: Queue completion check
            debugLog(
                `[processQueue:step6] Queue completion - Duration: ${formatDurationToStr(queueDuration)} - No remaining tasks and no active processes`
            );

            // Step 7: State cleanup
            state.setProcessing(false);
            debugLog(
                `[processQueue:step7] State cleanup - Duration: ${formatDurationToStr(queueDuration)} - Processing state set to false`
            );

            // Step 8: Final status
            debugLog(
                `[processQueue:step8] Final status - Duration: ${formatDurationToStr(queueDuration)} - All tasks completed successfully`
            );
        } else {
            // Step 6: Queue status
            debugLog(
                `[processQueue:step6] Queue status - Duration: ${formatDurationToStr(queueDuration)} - Remaining tasks: ${state.getQueueLength()}, Active processes: ${state.getActiveProcesses()}`
            );
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