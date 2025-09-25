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
