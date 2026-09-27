const logger = require('#@logger');
const { getThreadBus } = require('../common/thread_bus.js');
const startTime = Date.now() - Math.round(process.uptime() * 1000);
function formatDurationToStr(timestamp) {
    const seconds = Math.floor(timestamp / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    const remainingMonths = Math.floor((days % 365) / 30);
    const remainingDays = days % 30;
    const remainingHours = hours % 24;
    const remainingMinutes = minutes % 60;
    const remainingSeconds = seconds % 60;

    if (years > 0) {
        return `${years}y ${remainingMonths}m ${remainingDays}d ${remainingHours}h ${remainingMinutes}m`;
    }

    if (months > 0) {
        return `${months}m ${remainingDays}d ${remainingHours}h ${remainingMinutes}m`;
    }

    if (days > 0) {
        return `${days}d ${remainingHours}h ${remainingMinutes}m ${remainingSeconds}s`;
    }

    if (hours > 0) {
        return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
    }

    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    }

    return `${seconds}s`;
}

const logPrefix = `[ExitOn]`;

class ProcessHandler {
    constructor() {
        this.handlers = new Map();
        this.beforeExitHandlers = new Set();
        this.handlerSequence = 0;
    }

    // Shutdown handlers run through ThreadBus, the single SIGINT/SIGTERM coordinator
    addShutdownHandler(handler,name ) {
        const serviceName = `exiton:${name || handler.name || 'handler'}:${++this.handlerSequence}`;
        this.handlers.set(handler, serviceName);
        getThreadBus().register(serviceName, { onShutdown: async () => handler() });
    }

    removeShutdownHandler(handler) {
        const serviceName = this.handlers.get(handler);
        if (serviceName) {
            getThreadBus().unregister(serviceName);
            this.handlers.delete(handler);
        }
    }

    addBeforeExitHandler(handler) {
        this.beforeExitHandlers.add(handler);
    }

    getFunctionName(func){
        return func.name || func.toString();
    }

    async beforeExit(){
        logger.info(`${logPrefix} Received beforeExit`);
        let step = 1;
        for (const handler of this.beforeExitHandlers) {
            logger.refresh(`${logPrefix} [${this.getFunctionName(handler)} / beforeExit] ${step}/${this.beforeExitHandlers.size} executing...`);
            try {
                await handler();
                logger.refresh(`${logPrefix} [${this.getFunctionName(handler)} / beforeExit] ${step}/${this.beforeExitHandlers.size} success`);
                step++;
            } catch (error) {
                logger.error(`${logPrefix} [${this.getFunctionName(handler)} / beforeExit] ${step}/${this.beforeExitHandlers.size} error`);
                logger.error(error);
            }
        }
    }

    async executeShutdown(signal) {
        logger.info(`${logPrefix} Received ${signal}. Graceful shutdown...`);
        await getThreadBus().shutdown(signal, true);
        process.exit(0);
    }

    initialize() {
        getThreadBus();
        process.on('beforeExit', () => this.beforeExit());          
        process.on('exit', () => {
            const RunTime = Date.now() - startTime;
            const RunTimeStr = formatDurationToStr(RunTime);
            logger.info(`${logPrefix} Process exited RunTime: ${RunTimeStr}`);
        });
    }
}

const ExitOn = new ProcessHandler();
ExitOn.initialize();
module.exports = ExitOn; 