import { AppError } from '../../errors/errors.js';

export class Context {
    constructor(req, res) {
        this.req = req;
        this.res = res;
        this.user = req.user;
    }

    // Get query parameter with validation
    getQueryParam(name, required = false) {
        const value = this.req.query[name];
        if (required && !value) {
            throw new AppError(`Missing required query parameter: ${name}`, 'VALIDATION_FAILED');
        }
        return value;
    }

    // Get body parameter with validation
    getBodyParam(name, required = false) {
        const value = this.req.body[name];
        if (required && !value) {
            throw new AppError(`Missing required body parameter: ${name}`, 'VALIDATION_FAILED');
        }
        return value;
    }

    // Get URL parameter with validation
    getUrlParam(name, required = false) {
        const value = this.req.params[name];
        if (required && !value) {
            throw new AppError(`Missing required URL parameter: ${name}`, 'VALIDATION_FAILED');
        }
        return value;
    }

    // Send JSON response
    json(data, status = 200) {
        this.res.status(status).json(data);
    }

    // Send error response
    error(error) {
        const status = error instanceof AppError ? 400 : 500;
        this.res.status(status).json({
            error: error.code || 'INTERNAL_ERROR',
            message: error.message
        });
    }
}

// Context middleware factory
export const createContext = (handler) => {
    return async (req, res, next) => {
        try {
            const ctx = new Context(req, res);
            await handler(ctx);
        } catch (error) {
            next(error);
        }
    };
}; 