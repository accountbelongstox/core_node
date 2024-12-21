function createResponse(data = null, options = {}) {
    const {
        code = 200,
        message = 'success',
        path = undefined
    } = options;

    return {
        code,
        success: code >= 200 && code < 300,
        message,
        data,
        timestamp: Date.now(),
        path
    };
}

const ResponseUtil = {
    success: (data = null, message = 'success') => {
        return createResponse(data, { message });
    },

    error: (message = 'error', code = 500, data = null) => {
        return createResponse(data, { code, message });
    },

    validationError: (message = 'Validation Error', data = null) => {
        return createResponse(data, { code: 400, message });
    },

    unauthorized: (message = 'Unauthorized') => {
        return createResponse(null, { code: 401, message });
    },

    forbidden: (message = 'Forbidden') => {
        return createResponse(null, { code: 403, message });
    },

    notFound: (message = 'Not Found') => {
        return createResponse(null, { code: 404, message });
    }
};

module.exports = ResponseUtil;
