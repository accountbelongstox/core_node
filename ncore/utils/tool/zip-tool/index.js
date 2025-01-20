const state = require('./constants');
const taskManager = require('./task_manager');

module.exports = {
    // Task Management
    addFileCompressionTask: taskManager.addFileCompressionTask,
    addDirectoryCompressionTask: taskManager.addDirectoryCompressionTask,
    addCompressionTask: taskManager.addCompressionTask,
    addExtractionTask: taskManager.addExtractionTask,
    setGroupCallback: taskManager.setGroupCallback,

    // Configuration and Status
    setMaxProcessingSize: state.setMaxProcessingSize,
    setMultiProcessing: state.setMultiProcessing,
    getStatus: state.getStatus
}; 