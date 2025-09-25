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

// main.js
const { Worker } = require('worker_threads');
const { promisify } = require('util');
const path = require('path');
const { file } = require('#@btools');
const logger = require('#@logger');
const sleep = promisify(setTimeout);

class VoiceGenerationThread {
    constructor(options = {}) {
        this.options = {
            bufferSize: 10 * 1024 * 1024,
            checkInterval: 1000,           // 1 second
            maxRetries: 3,
            maxQueueSize: 100000,           // Maximum number of items in shared queue
            ...options
        };
        
        // Calculate buffer sizes
        this.HEADER_SIZE = 8; // 4 bytes for length + 4 bytes for position
        this.QUEUE_METADATA_SIZE = 2 * Int32Array.BYTES_PER_ELEMENT; // 2 integers for read/write indices
        this.QUEUE_ENTRY_SIZE = this.HEADER_SIZE;
        this.QUEUE_BUFFER_SIZE = this.QUEUE_METADATA_SIZE + (this.options.maxQueueSize * this.QUEUE_ENTRY_SIZE);
        
        // Create shared buffer for the queue metadata and headers
        this.sharedBuffer = new SharedArrayBuffer(this.QUEUE_BUFFER_SIZE);
        this.sharedArray = new Int32Array(this.sharedBuffer);
        this.sharedArray[0] = 0; // Read index
        this.sharedArray[1] = 0; // Write index
        
        // Create shared buffer for the actual data
        this.dataBuffer = new SharedArrayBuffer(this.options.bufferSize);
        this.dataView = new DataView(this.dataBuffer);
        
        this.worker = null;
        this.isRunning = false;
        this.taskQueue = [];
        this.keepAliveInterval = null;
        
        // Track current data position
        this.currentDataPosition = 0;
    }

    async start(workerPath=`voice_generate`) {
        if (this.isRunning) {
            logger.warn('Voice generation thread is already running');
            return false;
        }
        if(!file.isAbsolutePath(workerPath)){
            if(!workerPath.endsWith('.js')){
                workerPath = workerPath+'.js';
            }
            workerPath = path.join(__dirname, '../basetool/threads/', workerPath);
        }
        logger.debug('Worker path:', workerPath);
        try {
            this.worker = new Worker(workerPath, {
                workerData: {
                    queueBuffer: this.sharedBuffer,
                    dataBuffer: this.dataBuffer,
                    options: this.options
                }
            });

            this.setupWorkerEventHandlers();
            this.startKeepAlive();
            this.isRunning = true;
            
            logger.success('Voice generation thread started successfully');
            return true;
        } catch (error) {
            logger.error('Failed to start voice generation thread:', error);
            return false;
        }
    }

    startKeepAlive() {
        // Clear any existing interval
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
        }

        // Start a new keep-alive interval
        this.keepAliveInterval = setInterval(() => {
            if (this.isRunning) {
                this.worker?.postMessage({ type: 'ping' });
                const status = this.getStatus();
                logger.debug('Voice generation thread status:', status);
            }
        }, this.options.checkInterval);

        // Prevent the interval from keeping the process alive if everything else is done
        this.keepAliveInterval.unref();
    }

    setupWorkerEventHandlers() {
        this.worker.on('message', this.handleWorkerMessage.bind(this));
        this.worker.on('error', this.handleWorkerError.bind(this));
        this.worker.on('exit', this.handleWorkerExit.bind(this));
    }

    handleWorkerMessage(message) {
        const { type, data, error } = message;
        
        switch (type) {
            case 'task_complete':
                logger.success('Voice generation task completed:', data);
                break;
            case 'task_progress':
                logger.info('Voice generation progress:', data);
                break;
            case 'task_error':
                logger.error('Voice generation task error:', error);
                break;
            case 'pong':
                logger.debug('Worker is alive');
                break;
            default:
                logger.debug('Unknown message from worker:', message);
        }
    }

    handleWorkerError(error) {
        logger.error('Voice generation worker error:', error);
        this.restart();
    }

    handleWorkerExit(code) {
        this.isRunning = false;
        if (code !== 0) {
            logger.warn(`Voice generation worker exited with code ${code}`);
            this.restart();
        }
    }

    async restart() {
        await this.stop();
        await sleep(1000); // Wait before restarting
        await this.start();
    }

    async stop() {
        if (!this.isRunning) return;

        try {
            if (this.keepAliveInterval) {
                clearInterval(this.keepAliveInterval);
                this.keepAliveInterval = null;
            }

            this.worker?.postMessage({ type: 'stop' });
            await this.worker?.terminate();
            this.worker = null;
            this.isRunning = false;
            logger.success('Voice generation thread stopped successfully');
        } catch (error) {
            logger.error('Error stopping voice generation thread:', error);
        }
    }

    addToSharedList(item) {
        if (!this.isRunning) {
            logger.warn('Voice generation thread is not running');
            return false;
        }

        try {
            const writeIndex = Atomics.load(this.sharedArray, 1);
            const readIndex = Atomics.load(this.sharedArray, 0);
            
            // Check if queue is full
            if ((writeIndex + 1) % this.options.maxQueueSize === readIndex) {
                logger.refresh('Shared queue is full',"warn");
                return false;
            }

            // Convert item to bytes
            const encoder = new TextEncoder();
            const bytes = encoder.encode(JSON.stringify(item));
            
            // Check if we have enough space in the data buffer
            if (this.currentDataPosition + bytes.length > this.options.bufferSize) {
                this.currentDataPosition = 0; // Reset position if we're at the end
            }
            
            // Calculate positions
            const headerPosition = this.QUEUE_METADATA_SIZE + (writeIndex * this.QUEUE_ENTRY_SIZE);
            
            // Write header (data length and position)
            const headerView = new DataView(this.sharedBuffer);
            headerView.setInt32(headerPosition, bytes.length, true);
            headerView.setInt32(headerPosition + 4, this.currentDataPosition, true);
            
            // Write data
            for (let i = 0; i < bytes.length; i++) {
                this.dataView.setUint8(this.currentDataPosition + i, bytes[i]);
            }
            
            // Update data position
            this.currentDataPosition += bytes.length;
            
            // Update write index atomically
            Atomics.store(this.sharedArray, 1, (writeIndex + 1) % this.options.maxQueueSize);
            
            // Notify worker
            Atomics.notify(this.sharedArray, 1);
            
            return true;
        } catch (error) {
            logger.error('Failed to add item to shared list:', error);
            return false;
        }
    }

    getSharedListSize() {
        const writeIndex = Atomics.load(this.sharedArray, 1);
        const readIndex = Atomics.load(this.sharedArray, 0);
        return (writeIndex - readIndex + this.options.maxQueueSize) % this.options.maxQueueSize;
    }

    async addTask(task) {
        return this.addToSharedList(task);
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            pendingTasks: this.getSharedListSize(),
            writeIndex: Atomics.load(this.sharedArray, 1),
            readIndex: Atomics.load(this.sharedArray, 0)
        };
    }
}

module.exports = {
    VoiceGenerationThread,
};
