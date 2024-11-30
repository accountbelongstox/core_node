import logger from './logger.js';

/**
 * Standard response codes
 */
export const ResponseCode = {
    SUCCESS: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    SERVER_ERROR: 500
};

/**
 * Default messages for different scenarios
 */
const DefaultMessages = {
    SUCCESS: 'Operation completed successfully',
    FAILURE: 'Operation failed',
    NOT_FOUND: 'Resource not found',
    SERVER_ERROR: 'Internal server error',
    CREATED: 'Resource created successfully',
    BAD_REQUEST: 'Invalid request',
    UNAUTHORIZED: 'Unauthorized access',
    FORBIDDEN: 'Access forbidden'
};

/**
 * Create a standard response object
 * @param {*} data Response data
 * @param {string} [message] Response message
 * @param {boolean} [success=true] Success status
 * @param {number} [code=200] HTTP status code
 * @returns {Object} Standardized response object
 */
export function createResponse(data, message = '', success = true, code = ResponseCode.SUCCESS) {
    const response = {
        success,
        code,
        message: message || (success ? DefaultMessages.SUCCESS : DefaultMessages.FAILURE),
        data: data || null,
        timestamp: new Date().toISOString(),
        status: success ? 'Success' : 'Failed'
    };

    // Log response for debugging
    logger.debug('Creating response:', response);

    return response;
}

/**
 * Create a success response
 * @param {*} data Response data
 * @param {string} [message] Success message
 * @param {number} [code=200] HTTP status code
 * @returns {Object} Success response object
 */
export function successResponse(data, message = DefaultMessages.SUCCESS, code = ResponseCode.SUCCESS) {
    return createResponse(data, message, true, code);
}

/**
 * Create a failure response
 * @param {string} [message] Error message
 * @param {*} [data] Additional error data
 * @param {number} [code=500] HTTP status code
 * @returns {Object} Error response object
 */
export function failureResponse(message = DefaultMessages.FAILURE, data = null, code = ResponseCode.SERVER_ERROR) {
    return createResponse(data, message, false, code);
}

/**
 * Create a not found response
 * @param {string} [message] Custom not found message
 * @param {*} [data] Additional data
 * @returns {Object} Not found response object
 */
export function notFoundResponse(message = DefaultMessages.NOT_FOUND, data = null) {
    return createResponse(data, message, false, ResponseCode.NOT_FOUND);
}

/**
 * Express middleware to wrap response in standard format
 * @param {Function} handler Route handler function
 * @returns {Function} Middleware function
 */
export function wrapResponse(handler) {
    return async (req, res, next) => {
        try {
            const result = await handler(req, res, next);
            if (!res.headersSent) {
                res.json(successResponse(result));
            }
        } catch (error) {
            next(error);
        }
    };
}

/**
 * Express error handling middleware
 */
export function errorHandler(err, req, res, next) {
    logger.error('Request error:', err);
    
    if (!res.headersSent) {
        res.status(err.status || ResponseCode.SERVER_ERROR)
           .json(failureResponse(err.message));
    }
}

export default {
    createResponse,
    successResponse,
    failureResponse,
    notFoundResponse,
    wrapResponse,
    errorHandler,
    ResponseCode
}; 