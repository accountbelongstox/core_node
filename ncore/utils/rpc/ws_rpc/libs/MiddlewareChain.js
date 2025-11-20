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

class MiddlewareChain {
    constructor() {
        this.middlewares = [];
        this.errorHandlers = [];
    }

    use(middleware) {
        if (typeof middleware !== 'function') {
            logger.error('Middleware must be a function');
            return this;
        }

        this.middlewares.push(middleware);
        logger.debug(`Middleware registered, total: ${this.middlewares.length}`);
        return this;
    }

    useError(errorHandler) {
        if (typeof errorHandler !== 'function') {
            logger.error('Error handler must be a function');
            return this;
        }

        this.errorHandlers.push(errorHandler);
        logger.debug(`Error handler registered, total: ${this.errorHandlers.length}`);
        return this;
    }

    async execute(context, handler) {
        const middlewares = [...this.middlewares];
        let index = 0;

        const next = async () => {
            if (index >= middlewares.length) {
                return await handler(context);
            }

            const middleware = middlewares[index++];

            try {
                return await middleware(context, next);
            } catch (error) {
                return await this._handleError(error, context);
            }
        };

        try {
            return await next();
        } catch (error) {
            return await this._handleError(error, context);
        }
    }

    async _handleError(error, context) {
        for (const errorHandler of this.errorHandlers) {
            try {
                const result = await errorHandler(error, context);
                if (result !== undefined) {
                    return result;
                }
            } catch (handlerError) {
                logger.error('Error in error handler:', handlerError);
            }
        }

        throw error;
    }

    clear() {
        this.middlewares = [];
        this.errorHandlers = [];
        logger.debug('Middleware chain cleared');
    }

    count() {
        return {
            middlewares: this.middlewares.length,
            errorHandlers: this.errorHandlers.length
        };
    }
}

module.exports = MiddlewareChain;
