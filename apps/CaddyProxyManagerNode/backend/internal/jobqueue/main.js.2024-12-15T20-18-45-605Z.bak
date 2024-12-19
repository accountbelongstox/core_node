import { EventEmitter } from 'events';
import { Worker } from './worker.js';
import logger from '../logger/logger.js';
import config from '../../config/index.js';

class JobQueue extends EventEmitter {
    #jobs = [];
    #worker = null;
    #isRunning = false;

    start = () => {
        if (this.#isRunning) {
            return;
        }

        this.#isRunning = true;
        this.#worker = new Worker(this);
        this.#worker.start();
        logger.info('Job queue started');
    }

    shutdown = () => {
        if (!this.#isRunning) {
            return Promise.reject(new Error('Job queue is not running'));
        }

        this.#isRunning = false;
        if (this.#worker) {
            this.#worker.stop();
        }
        logger.info('Job queue stopped');
        return Promise.resolve();
    }

    addJob = (job) => {
        if (!this.#isRunning) {
            return Promise.reject(new Error('Job queue is not running'));
        }
        
        this.#jobs.push(job);
        this.emit('jobAdded', job);
        return Promise.resolve();
    }

    hasJobs = () => {
        return this.#jobs.length > 0;
    }

    getNextJob = () => {
        return this.#jobs.shift();
    }
}

const queue = new JobQueue();

export default {
    start: () => queue.start(),
    shutdown: () => queue.shutdown(),
    addJob: (job) => queue.addJob(job),
    JobQueue
}; 