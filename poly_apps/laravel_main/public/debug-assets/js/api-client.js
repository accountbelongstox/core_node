/**
 * Unified API Client
 * Centralized API endpoint definitions and methods
 * Usage: ApiClient.json(ApiClient.PointUrlKey.ENDPOINT_KEY, 'GET', data)
 */

class ApiClient {
    constructor() {
        this.csrfToken = this.getCsrfToken();
        this.authToken = localStorage.getItem('auth_token');
    }

    getCsrfToken() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta.getAttribute('content');
    }

    getAuthToken() {
        return localStorage.getItem('auth_token');
    }

    buildHeaders(customHeaders = {}, includeAuth = true, isFormData = false) {
        const headers = {};

        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }

        headers['Accept'] = 'application/json';
        headers['X-CSRF-TOKEN'] = this.getCsrfToken();

        if (includeAuth) {
            const authToken = this.getAuthToken();
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        return Object.assign(headers, customHeaders);
    }

    async request(url, options = {}) {
        const response = await fetch(url, options);
        return response;
    }

    async get(url, options = {}) {
        const headers = options.headers;
        const includeAuth = options.includeAuth;
        const restOptions = Object.assign({}, options);
        delete restOptions.headers;
        delete restOptions.includeAuth;

        return this.request(url, {
            method: 'GET',
            headers: this.buildHeaders(headers, includeAuth, false),
            ...restOptions
        });
    }

    async post(url, data = null, options = {}) {
        const headers = options.headers;
        const includeAuth = options.includeAuth;
        const restOptions = Object.assign({}, options);
        delete restOptions.headers;
        delete restOptions.includeAuth;
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
    }

    async put(url, data = null, options = {}) {
        const headers = options.headers;
        const includeAuth = options.includeAuth;
        const restOptions = Object.assign({}, options);
        delete restOptions.headers;
        delete restOptions.includeAuth;

        const requestOptions = {
            method: 'PUT',
            headers: this.buildHeaders(headers, includeAuth, false),
            ...restOptions
        };

        if (data) {
            requestOptions.body = JSON.stringify(data);
        }

        return this.request(url, requestOptions);
    }

    async delete(url, options = {}) {
        const headers = options.headers;
        const includeAuth = options.includeAuth;
        const restOptions = Object.assign({}, options);
        delete restOptions.headers;
        delete restOptions.includeAuth;

        return this.request(url, {
            method: 'DELETE',
            headers: this.buildHeaders(headers, includeAuth, false),
            ...restOptions
        });
    }

    async patch(url, data = null, options = {}) {
        const headers = options.headers;
        const includeAuth = options.includeAuth;
        const restOptions = Object.assign({}, options);
        delete restOptions.headers;
        delete restOptions.includeAuth;

        const requestOptions = {
            method: 'PATCH',
            headers: this.buildHeaders(headers, includeAuth, false),
            ...restOptions
        };

        if (data) {
            requestOptions.body = JSON.stringify(data);
        }

        return this.request(url, requestOptions);
    }

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
    }

    async initCsrfToken() {
        const response = await fetch('/csrf-token');
        const data = await response.json();
        const metaTag = document.createElement('meta');
        metaTag.name = 'csrf-token';
        metaTag.setAttribute('content', data.csrf_token);
        document.head.appendChild(metaTag);
    }
}

// API Endpoint URL Keys
ApiClient.PointUrlKey = {
    API_INFO: '/api_info',
    API_HEADERS_CACHE_SAVE: '/api_headers_cache/save',
    API_HEADERS_CACHE_RESET: '/api_headers_cache/reset',
    API_PARAMS_CACHE_SAVE: '/api_params_cache/save',
    API_PARAMS_CACHE_LOAD: '/api_params_cache/load',
    TEMPLATE_API_ITEM: '/debug-assets/debug-tools/templates/api-item.html',
    TEMPLATE_FEATURE_DOCS: '/debug-assets/debug-tools/templates/feature-docs.html',
    TEMPLATE_SHARED_HEADER_ITEM: '/debug-assets/debug-tools/templates/shared-header-item.html',
    TEMPLATE_SHARED_HEADERS_SECTION: '/debug-assets/debug-tools/templates/shared-headers-section.html'
};

const apiClientInstance = new ApiClient();

apiClientInstance.initCsrfToken();

window.ApiClient = ApiClient;
window.apiClientInstance = apiClientInstance;
