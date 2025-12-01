// ============================================
// NAMESPACE: APIClient
// FILE: api-client.js
// PURPOSE: 统一的API请求客户端库，处理CSRF token、认证和错误处理
// ============================================

const APIClient = {
    /**
     * 获取CSRF Token
     */
    getCsrfToken() {
        return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    },

    /**
     * 获取认证Token
     */
    getAuthToken() {
        return localStorage.getItem('auth_token');
    },

    /**
     * 构建请求headers
     * @param {Object} customHeaders - 自定义headers
     * @param {boolean} includeAuth - 是否包含认证token
     * @param {boolean} isFormData - 是否为FormData请求
     */
    buildHeaders(customHeaders = {}, includeAuth = true, isFormData = false) {
        const headers = {};

        // 如果不是FormData，添加Content-Type
        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }

        // 添加Accept header
        headers['Accept'] = 'application/json';

        // 添加CSRF Token
        headers['X-CSRF-TOKEN'] = this.getCsrfToken();

        // 添加认证token
        if (includeAuth) {
            const authToken = this.getAuthToken();
            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }
        }

        // 合并自定义headers（会覆盖默认值）
        return { ...headers, ...customHeaders };
    },

    /**
     * 通用请求方法
     * @param {string} url - 请求URL
     * @param {Object} options - fetch选项
     */
    async request(url, options = {}) {
        try {
            const response = await fetch(url, options);
            return response;
        } catch (error) {
            console.error('[APIClient] Request error:', error);
            throw error;
        }
    },

    /**
     * GET请求
     * @param {string} url - 请求URL
     * @param {Object} options - 额外选项
     * @param {Object} options.headers - 自定义headers
     * @param {boolean} options.includeAuth - 是否包含认证token（默认true）
     */
    async get(url, options = {}) {
        const { headers = {}, includeAuth = true, ...restOptions } = options;

        return this.request(url, {
            method: 'GET',
            headers: this.buildHeaders(headers, includeAuth, false),
            ...restOptions
        });
    },

    /**
     * POST请求
     * @param {string} url - 请求URL
     * @param {Object|FormData} data - 请求数据
     * @param {Object} options - 额外选项
     * @param {Object} options.headers - 自定义headers
     * @param {boolean} options.includeAuth - 是否包含认证token（默认true）
     */
    async post(url, data = null, options = {}) {
        const { headers = {}, includeAuth = true, ...restOptions } = options;
        const isFormData = data instanceof FormData;

        const requestOptions = {
            method: 'POST',
            headers: this.buildHeaders(headers, includeAuth, isFormData),
            ...restOptions
        };

        if (data) {
            requestOptions.body = isFormData ? data : JSON.stringify(data);
        }

        return this.request(url, requestOptions);
    },

    /**
     * PUT请求
     * @param {string} url - 请求URL
     * @param {Object} data - 请求数据
     * @param {Object} options - 额外选项
     */
    async put(url, data = null, options = {}) {
        const { headers = {}, includeAuth = true, ...restOptions } = options;

        const requestOptions = {
            method: 'PUT',
            headers: this.buildHeaders(headers, includeAuth, false),
            ...restOptions
        };

        if (data) {
            requestOptions.body = JSON.stringify(data);
        }

        return this.request(url, requestOptions);
    },

    /**
     * DELETE请求
     * @param {string} url - 请求URL
     * @param {Object} options - 额外选项
     */
    async delete(url, options = {}) {
        const { headers = {}, includeAuth = true, ...restOptions } = options;

        return this.request(url, {
            method: 'DELETE',
            headers: this.buildHeaders(headers, includeAuth, false),
            ...restOptions
        });
    },

    /**
     * PATCH请求
     * @param {string} url - 请求URL
     * @param {Object} data - 请求数据
     * @param {Object} options - 额外选项
     */
    async patch(url, data = null, options = {}) {
        const { headers = {}, includeAuth = true, ...restOptions } = options;

        const requestOptions = {
            method: 'PATCH',
            headers: this.buildHeaders(headers, includeAuth, false),
            ...restOptions
        };

        if (data) {
            requestOptions.body = JSON.stringify(data);
        }

        return this.request(url, requestOptions);
    },

    /**
     * 发送JSON请求并返回JSON响应
     * @param {string} url - 请求URL
     * @param {string} method - HTTP方法
     * @param {Object|FormData} data - 请求数据
     * @param {Object} options - 额外选项
     */
    async json(url, method = 'GET', data = null, options = {}) {
        let response;

        switch (method.toUpperCase()) {
            case 'GET':
                response = await this.get(url, options);
                break;
            case 'POST':
                response = await this.post(url, data, options);
                break;
            case 'PUT':
                response = await this.put(url, data, options);
                break;
            case 'DELETE':
                response = await this.delete(url, options);
                break;
            case 'PATCH':
                response = await this.patch(url, data, options);
                break;
            default:
                throw new Error(`Unsupported HTTP method: ${method}`);
        }

        return response.json();
    },

    /**
     * 初始化CSRF Token（在页面加载时调用）
     */
    async initCsrfToken() {
        try {
            const response = await fetch('/csrf-token');
            const data = await response.json();
            if (data.csrf_token) {
                const metaTag = document.querySelector('meta[name="csrf-token"]');
                if (metaTag) {
                    metaTag.setAttribute('content', data.csrf_token);
                } else {
                    const newMetaTag = document.createElement('meta');
                    newMetaTag.name = 'csrf-token';
                    newMetaTag.content = data.csrf_token;
                    document.head.appendChild(newMetaTag);
                }
            }
        } catch (error) {
            console.error('[APIClient] Failed to load CSRF token:', error);
        }
    }
};

// 导出到全局（兼容现有代码）
if (typeof window !== 'undefined') {
    window.APIClient = APIClient;
}
