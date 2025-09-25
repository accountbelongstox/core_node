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

// worker.js
const { parentPort, workerData } = require('worker_threads');
const { promisify } = require('util');
const logger = require('#@logger');
const sleep = promisify(setTimeout);
const processHandler = require('#@/ncore/foundation/utilities/process_on.js');
class VoiceGenerationWorker {
    constructor(queueBuffer, dataBuffer, options) {
        this.options = options;
        
        // Set up queue buffer views
        this.sharedBuffer = queueBuffer;
        this.sharedArray = new Int32Array(queueBuffer);
        
        // Set up data buffer view
        this.dataBuffer = dataBuffer;
        this.dataView = new DataView(dataBuffer);
        
        // Calculate buffer sizes (must match main thread)
        this.HEADER_SIZE = 8; // 4 bytes for length + 4 bytes for position
        this.QUEUE_METADATA_SIZE = 2 * Int32Array.BYTES_PER_ELEMENT;
        this.QUEUE_ENTRY_SIZE = this.HEADER_SIZE;
        
        this.isRunning = true;
        this.currentTask = null;
        this.lastPingTime = Date.now();
        this.keepAliveTimeout = null;
    }

    async start() {
        logger.info('Voice generation worker started');
        
        // Start keep-alive check
        this.startKeepAliveCheck();
        
        // Main processing loop
        while (this.isRunning) {
            try {
            const item = this.getNextFromSharedList();
            if (item) {
                await this.processTask(item);
            } else {
                // Wait for notification of new data with timeout
                Atomics.wait(this.sharedArray, 1, Atomics.load(this.sharedArray, 1), 1000);
            }

            // Log queue status
            const readIndex = Atomics.load(this.sharedArray, 0);
            const writeIndex = Atomics.load(this.sharedArray, 1);
            const queueSize = (writeIndex - readIndex + this.options.maxQueueSize) % this.options.maxQueueSize;
            logger.info(`[${new Date().toISOString()}] Current queue size: ${queueSize} tasks`);
            } catch (error) {
                logger.error('Error in worker processing loop:', error);
                await sleep(1000); // Prevent tight loop on error
            }
        }
        
        logger.info('Voice generation worker stopping...');
    }

    startKeepAliveCheck() {
        // Check connection to main thread
        this.keepAliveTimeout = setInterval(() => {
            const now = Date.now();
            if (now - this.lastPingTime > this.options.checkInterval * 3) {
                logger.warn('No ping received from main thread for too long, worker might be orphaned');
            }
        }, this.options.checkInterval);
        
        // Don't let this interval prevent process exit
        this.keepAliveTimeout.unref();
    }

    getNextFromSharedList() {
        const readIndex = Atomics.load(this.sharedArray, 0);
        const writeIndex = Atomics.load(this.sharedArray, 1);

        if (readIndex === writeIndex) {
            return null; // Queue is empty
        }

        try {
            // Calculate header position
            const headerPosition = this.QUEUE_METADATA_SIZE + (readIndex * this.QUEUE_ENTRY_SIZE);
            
            // Read header from queue buffer
            const headerView = new DataView(this.sharedBuffer);
            const dataLength = headerView.getInt32(headerPosition, true);
            const dataPosition = headerView.getInt32(headerPosition + 4, true);
            
            // Read data from data buffer
            const bytes = new Uint8Array(dataLength);
            for (let i = 0; i < dataLength; i++) {
                bytes[i] = this.dataView.getUint8(dataPosition + i);
            }

            // Update read index atomically
            Atomics.store(this.sharedArray, 0, (readIndex + 1) % this.options.maxQueueSize);

            // Convert bytes back to object
            const decoder = new TextDecoder();
            const jsonStr = decoder.decode(bytes);
            return JSON.parse(jsonStr);
        } catch (error) {
            logger.error('Error reading from shared list:', error);
            return null;
        }
    }

    async processTask(task) {
        try {
            this.currentTask = task;
            logger.info('Processing voice generation task:', task);

            // Report progress
            parentPort.postMessage({
                type: 'task_progress',
                data: {
                    taskId: task.id,
                    progress: 0
                }
            });

            // Simulate voice generation process
            await sleep(1000);

            // Report completion
            parentPort.postMessage({
                type: 'task_complete',
                data: {
                    taskId: task.id,
                    result: 'Voice generated successfully'
                }
            });
        } catch (error) {
            parentPort.postMessage({
                type: 'task_error',
                error: error.message,
                taskId: task?.id
            });
        } finally {
            this.currentTask = null;
        }
    }

    stop() {
        this.isRunning = false;
        if (this.keepAliveTimeout) {
            clearInterval(this.keepAliveTimeout);
        }
        Atomics.notify(this.sharedArray, 1); // Wake up the worker if it's waiting
    }

    handleMessage(message) {
        const { type } = message;
        
        switch (type) {
            case 'stop':
                this.stop();
                break;
            case 'ping':
                this.lastPingTime = Date.now();
                parentPort.postMessage({ type: 'pong' });
                break;
            default:
                logger.warn('Unknown message type:', type);
        }
    }
}

// Initialize and start the worker
const { queueBuffer, dataBuffer, options } = workerData;
const worker = new VoiceGenerationWorker(queueBuffer, dataBuffer, options);
parentPort.on('message', (message) => {
    worker.handleMessage(message);
});
processHandler.addBeforeExitHandler(() => {
    logger.warn('Worker process is about to exit');
});
processHandler.addShutdownHandler(() => {
    worker.stop();
});

worker.start().catch(error => {
    logger.error('Worker error:', error);
    process.exit(1);
});
