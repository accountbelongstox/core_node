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
