const { Worker, isMainThread, parentPort } = require('worker_threads');
const queueManager = require('./queue_manager');

class QueueWorkerWrapper {
    constructor() {
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        if (isMainThread) {
            // Main thread event handling
            queueManager.on('itemAdded', ({ groupName, item }) => {
                if (this.worker) {
                    this.worker.postMessage({
                        type: 'queueUpdate',
                        action: 'itemAdded',
                        groupName,
                        item
                    });
                }
            });

            queueManager.on('itemRemoved', ({ groupName, item }) => {
                if (this.worker) {
                    this.worker.postMessage({
                        type: 'queueUpdate',
                        action: 'itemRemoved',
                        groupName,
                        item
                    });
                }
            });
        } else {
            // Worker thread event handling
            parentPort.on('message', (message) => {
                if (message.type === 'queueUpdate') {
                    switch (message.action) {
                        case 'itemAdded':
                            queueManager.addItem(message.groupName, message.item);
                            break;
                        case 'itemRemoved':
                            queueManager.removeItem(message.groupName);
                            break;
                        case 'getQueue':
                            parentPort.postMessage({
                                type: 'queueResponse',
                                groupName: message.groupName,
                                queue: queueManager.getQueue(message.groupName)
                            });
                            break;
                        case 'getAllQueues':
                            parentPort.postMessage({
                                type: 'queueResponse',
                                queues: queueManager.getAllQueues()
                            });
                            break;
                    }
                }
            });
        }
    }

    // Main thread methods
    initWorker(workerPath) {
        if (isMainThread) {
            this.worker = new Worker(workerPath);
            this.worker.on('message', (message) => {
                if (message.type === 'queueRequest') {
                    switch (message.action) {
                        case 'getQueue':
                            this.worker.postMessage({
                                type: 'queueResponse',
                                groupName: message.groupName,
                                queue: queueManager.getQueue(message.groupName)
                            });
                            break;
                        case 'getAllQueues':
                            this.worker.postMessage({
                                type: 'queueResponse',
                                queues: queueManager.getAllQueues()
                            });
                            break;
                    }
                }
            });
        }
    }

    // Methods available in both main and worker threads
    addItem(groupName, item) {
        return queueManager.addItem(groupName, item);
    }

    removeItem(groupName) {
        return queueManager.removeItem(groupName);
    }

    peekItem(groupName) {
        return queueManager.peekItem(groupName);
    }

    getLength(groupName) {
        return queueManager.getLength(groupName);
    }

    getTotalLength() {
        return queueManager.getTotalLength();
    }

    getQueue(groupName) {
        return queueManager.getQueue(groupName);
    }

    getAllQueues() {
        return queueManager.getAllQueues();
    }

    getGroupNames() {
        return queueManager.getGroupNames();
    }

    clearGroup(groupName) {
        return queueManager.clearGroup(groupName);
    }

    clearAll() {
        return queueManager.clearAll();
    }
}

// Create a singleton instance
const queueWorkerWrapper = new QueueWorkerWrapper();

module.exports = queueWorkerWrapper; 