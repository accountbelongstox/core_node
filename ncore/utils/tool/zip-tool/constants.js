const logger = require('#@logger');
const { formatSize } = require('./zutils');

// Queue state
let queue = [];
let isProcessing = false;
let currentTask = null;

// Size tracking
let maxProcessingSize = 1024 * 1024 * 1024; // Default: 1GB
let currentProcessingSize = 0;

// Process control
let enableMultiProcess = false;
let maxConcurrentProcesses = 10;
let activeProcesses = 0;
const activeTasks = new Map(); // taskId -> { task, size }

// Group management
const groups = new Map();

// State management functions
function addToQueue(task) {
    queue.push(task);
}

function removeFromQueue() {
    return queue.shift();
}

function setProcessing(value) {
    isProcessing = value;
}

function setCurrentTask(task) {
    currentTask = task;
}

function addProcessingSize(size) {
    currentProcessingSize += size;
    logger.info(`Added ${formatSize(size)} to processing size (Total: ${formatSize(currentProcessingSize)})`);
}

function removeProcessingSize(size) {
    currentProcessingSize -= size;
    logger.info(`Removed ${formatSize(size)} from processing size (Total: ${formatSize(currentProcessingSize)})`);
}

function incrementActiveProcesses() {
    activeProcesses++;
}

function decrementActiveProcesses() {
    activeProcesses--;
}

function addActiveTask(taskId, task, size) {
    activeTasks.set(taskId, { task, size });
}

function removeActiveTask(taskId) {
    return activeTasks.delete(taskId);
}

function getActiveTask(taskId) {
    return activeTasks.get(taskId);
}

function getActiveTasksForGroup(groupName) {
    return Array.from(activeTasks.values())
        .filter(({ task }) => task.groupName === groupName);
}

function addGroup(groupName, callback) {
    groups.set(groupName, { callback });
}

function removeGroup(groupName) {
    groups.delete(groupName);
}

function getGroup(groupName) {
    return groups.get(groupName);
}

/**
 * Set maximum processing size limit
 * @param {number} sizeInBytes - Maximum size in bytes
 */
function setMaxProcessingSize(sizeInBytes) {
    maxProcessingSize = sizeInBytes;
    logger.info(`Set maximum processing size to ${formatSize(maxProcessingSize)}`);
}

/**
 * Enable or disable multi-process execution
 * @param {boolean} enable - Whether to enable multi-process
 */
function setMultiProcessing(enable) {
    enableMultiProcess = enable;
    logger.info(`Multi-process execution ${enable ? 'enabled' : 'disabled'}`);
}

/**
 * Get current processing status including size information
 * @returns {Object} Status object
 */
function getStatus() {
    return {
        queueLength: queue.length,
        isProcessing,
        currentTask,
        groups: Array.from(groups.keys()),
        sizeLimit: formatSize(maxProcessingSize),
        currentSize: formatSize(currentProcessingSize),
        availableSize: formatSize(maxProcessingSize - currentProcessingSize),
        multiProcess: {
            enabled: enableMultiProcess,
            activeProcesses,
            maxProcesses: maxConcurrentProcesses
        }
    };
}

module.exports = {
    // State getters
    getQueue: () => queue,
    getQueueLength: () => queue.length,
    isProcessing: () => isProcessing,
    getCurrentTask: () => currentTask,
    getMaxProcessingSize: () => maxProcessingSize,
    getCurrentProcessingSize: () => currentProcessingSize,
    isMultiProcessEnabled: () => enableMultiProcess,
    getMaxConcurrentProcesses: () => maxConcurrentProcesses,
    getActiveProcesses: () => activeProcesses,
    
    // State management
    addToQueue,
    removeFromQueue,
    setProcessing,
    setCurrentTask,
    addProcessingSize,
    removeProcessingSize,
    incrementActiveProcesses,
    decrementActiveProcesses,
    addActiveTask,
    removeActiveTask,
    getActiveTask,
    getActiveTasksForGroup,
    addGroup,
    removeGroup,
    getGroup,
    
    // Configuration
    setMaxProcessingSize,
    setMultiProcessing,
    getStatus
}; 