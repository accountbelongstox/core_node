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

const logger = require('#@logger');
let startTime = null
try{
    const {startTime:startTimeFromGvar} = require('#@global_vars')
    startTime = startTimeFromGvar
}catch(error){
    startTime = new Date()
}
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
        this.handlers = new Set();
        this.beforeExitHandlers = new Set();
    }

    addShutdownHandler(handler,name ) {
        this.handlers.add(handler);
    }

    removeShutdownHandler(handler) {
        this.handlers.delete(handler);
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
        let step = 1;
        for (const handler of this.handlers) {
            logger.refresh(`${logPrefix} [${this.getFunctionName(handler)} / ${signal}] ${step}/${this.handlers.size} executing...`);
            try {
                await handler();
                logger.refresh(`${logPrefix} [${this.getFunctionName(handler)} / ${signal}] ${step}/${this.handlers.size} success`);
                step++;
            } catch (error) {
                logger.error(`${logPrefix} [${this.getFunctionName(handler)} / ${signal}] ${step}/${this.handlers.size} error`);
                logger.error(error);
            }
        }
        process.exit(0);
    }

    initialize() {
        process.on('SIGINT', () => this.executeShutdown('SIGINT'));
        process.on('SIGTERM', () => this.executeShutdown('SIGTERM'));
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