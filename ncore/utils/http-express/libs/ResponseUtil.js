/**
 * 创建统一的响应格式
 * @param {*} data - 响应数据
 * @param {Object} options - 响应选项
 * @param {number} [options.code=200] - 状态码
 * @param {string} [options.message='success'] - 响应消息
 * @param {string} [options.path] - 请求路径
 * @returns {Object} 统一格式的响应对象
 */
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

export const ResponseUtil = {
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

export default ResponseUtil; 