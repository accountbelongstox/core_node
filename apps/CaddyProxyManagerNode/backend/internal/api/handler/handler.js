import { AppError } from '../../errors/errors.js';
import logger from '../../logger/logger.js';

export class BaseHandler {
    constructor() {
        if (this.constructor === BaseHandler) {
            throw new Error('Cannot instantiate abstract class');
        }
    }

    async handle(ctx) {
        try {
            await this.process(ctx);
        } catch (error) {
            if (error instanceof AppError) {
                logger.warn('RequestError', error);
                ctx.error(error);
            } else {
                logger.error('HandlerError', error);
                ctx.error(new AppError('internal-server-error', 'INTERNAL_ERROR'));
            }
        }
    }

    // Abstract method to be implemented by subclasses
    async process(ctx) {
        throw new Error('Method not implemented');
    }

    validateRequest(request) {
        if (!request?.validate) {
            throw new AppError('invalid-request', 'VALIDATION_FAILED');
        }
        request.validate();
    }
} 