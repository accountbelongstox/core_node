const EventEmitter = require('events').EventEmitter;
    const { Worker } = require('./worker.js');
    const logger = require('../logger/logger.js');
    const config = require('../../config/index.js');

    class JobQueue extends EventEmitter {
        constructor() {
            super();
            this.#jobs = [];
            this.#worker = null;
            this.#isRunning = false;
        }

        start() {
            if (this.#isRunning) {
                return;
            }

            this.#isRunning = true;
            this.#worker = new Worker(this);
            this.#worker.start();
            logger.info('Job queue started');
        }

        shutdown() {
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

        addJob(job) {
            if (!this.#isRunning) {
                return Promise.reject(new Error('Job queue is not running'));
            }

            this.#jobs.push(job);
            this.emit('jobAdded', job);
            return Promise.resolve();
        }

        hasJobs() {
            return this.#jobs.length > 0;
        }

        getNextJob() {
            return this.#jobs.shift();
        }
    }

    const queue = new JobQueue();

    module.exports = {
        start: () => queue.start(),
        shutdown: () => queue.shutdown(),
        addJob: (job) => queue.addJob(job),
        JobQueue
    };