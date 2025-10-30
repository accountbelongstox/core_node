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

class InterceptorManager {
    constructor() {
        this.requestInterceptors = [];
        this.responseInterceptors = [];
        this.errorInterceptors = [];
    }

    addRequestInterceptor(onFulfilled, onRejected = null) {
        const id = this.requestInterceptors.length;
        this.requestInterceptors.push({
            id,
            onFulfilled,
            onRejected
        });
        logger.debug(`Request interceptor added: ${id}`);
        return id;
    }

    addResponseInterceptor(onFulfilled, onRejected = null) {
        const id = this.responseInterceptors.length;
        this.responseInterceptors.push({
            id,
            onFulfilled,
            onRejected
        });
        logger.debug(`Response interceptor added: ${id}`);
        return id;
    }

    addErrorInterceptor(handler) {
        const id = this.errorInterceptors.length;
        this.errorInterceptors.push({
            id,
            handler
        });
        logger.debug(`Error interceptor added: ${id}`);
        return id;
    }

    async executeRequestInterceptors(request) {
        let result = request;

        for (const interceptor of this.requestInterceptors) {
            try {
                if (interceptor.onFulfilled) {
                    result = await interceptor.onFulfilled(result);
                }
            } catch (error) {
                if (interceptor.onRejected) {
                    result = await interceptor.onRejected(error);
                } else {
                    logger.error('Request interceptor error:', error);
                    throw error;
                }
            }
        }

        return result;
    }

    async executeResponseInterceptors(response) {
        let result = response;

        for (const interceptor of this.responseInterceptors) {
            try {
                if (interceptor.onFulfilled) {
                    result = await interceptor.onFulfilled(result);
                }
            } catch (error) {
                if (interceptor.onRejected) {
                    result = await interceptor.onRejected(error);
                } else {
                    logger.error('Response interceptor error:', error);
                    throw error;
                }
            }
        }

        return result;
    }

    async executeErrorInterceptors(error, context = {}) {
        let result = error;

        for (const interceptor of this.errorInterceptors) {
            try {
                const handlerResult = await interceptor.handler(result, context);
                if (handlerResult !== undefined) {
                    result = handlerResult;
                }
            } catch (handlerError) {
                logger.error('Error interceptor failed:', handlerError);
            }
        }

        return result;
    }

    removeRequestInterceptor(id) {
        this.requestInterceptors = this.requestInterceptors.filter(i => i.id !== id);
        logger.debug(`Request interceptor removed: ${id}`);
    }

    removeResponseInterceptor(id) {
        this.responseInterceptors = this.responseInterceptors.filter(i => i.id !== id);
        logger.debug(`Response interceptor removed: ${id}`);
    }

    removeErrorInterceptor(id) {
        this.errorInterceptors = this.errorInterceptors.filter(i => i.id !== id);
        logger.debug(`Error interceptor removed: ${id}`);
    }

    clearAll() {
        this.requestInterceptors = [];
        this.responseInterceptors = [];
        this.errorInterceptors = [];
        logger.debug('All interceptors cleared');
    }

    getCount() {
        return {
            request: this.requestInterceptors.length,
            response: this.responseInterceptors.length,
            error: this.errorInterceptors.length
        };
    }
}

module.exports = InterceptorManager;
