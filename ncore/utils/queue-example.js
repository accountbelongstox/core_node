'use strict';
const Base = require('#@base');
const { httptool, zip, file } = require('../utils.js');

class Softinstall extends Base {
    taskQueue = {}
    isQueueRunning = false;

    constructor() {
        super();
    }

    addQueue(software) {
        if (!software || typeof software !== 'object') {
            console.error('Invalid software object.');
            return;
        }

        if (!software.hasOwnProperty('basename')) {
            console.error('Software object must have a basename property.');
            return;
        }

        const { aid } = software;

        if (aid in this.taskQueue) {
            console.warn(`${aid} is already in the installation queue.`);
            return;
        }

        this.taskQueue[aid] = software;

        if (!this.isQueueRunning) {
            this.popQueue();
        }
    }

    popQueue() {
        const queueLength = Object.keys(this.taskQueue).length;
        if (queueLength > 0) {
            const keys = Object.keys(this.taskQueue);
            const firstKey = keys[0];
            const software = this.taskQueue[firstKey];
            delete this.taskQueue[firstKey];
            const basename = software.basename;
        } else {
            this.isQueueRunning = false
        }
    }

}
