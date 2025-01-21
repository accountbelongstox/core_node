const { EventEmitter } = require('events');

class QueueManager {
    constructor() {
        this.queues = {};
        this.eventEmitter = new EventEmitter();
    }

    // Add item to a specific group queue
    addItem(groupName, item) {
        if (!this.queues[groupName]) {
            this.queues[groupName] = [];
        }
        this.queues[groupName].push(item);
        this.eventEmitter.emit('itemAdded', { groupName, item });
        return true;
    }

    // Remove and return the first item from a group queue
    removeItem(groupName) {
        if (!this.queues[groupName] || this.queues[groupName].length === 0) {
            return null;
        }
        const item = this.queues[groupName].shift();
        this.eventEmitter.emit('itemRemoved', { groupName, item });
        return item;
    }

    // Get the first item without removing it
    peekItem(groupName) {
        if (!this.queues[groupName] || this.queues[groupName].length === 0) {
            return null;
        }
        return this.queues[groupName][0];
    }

    // Get length of a specific group queue
    getLength(groupName) {
        return this.queues[groupName]?.length || 0;
    }

    // Get total length of all queues
    getTotalLength() {
        return Object.values(this.queues).reduce((total, queue) => total + queue.length, 0);
    }

    // Get all items in a group queue
    getQueue(groupName) {
        return this.queues[groupName] || [];
    }

    // Get all queues
    getAllQueues() {
        return this.queues;
    }

    // Get all group names
    getGroupNames() {
        return Object.keys(this.queues);
    }

    // Clear a specific group queue
    clearGroup(groupName) {
        if (this.queues[groupName]) {
            this.queues[groupName] = [];
            this.eventEmitter.emit('groupCleared', { groupName });
        }
    }

    // Clear all queues
    clearAll() {
        this.queues = {};
        this.eventEmitter.emit('allCleared');
    }

    // Subscribe to queue events
    on(event, callback) {
        this.eventEmitter.on(event, callback);
    }

    // Remove event listener
    off(event, callback) {
        this.eventEmitter.off(event, callback);
    }
}

// Create a singleton instance
const queueManager = new QueueManager();

module.exports = queueManager; 