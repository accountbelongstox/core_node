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
        if (!meta) {
            return '';
        }
        const token = meta.getAttribute('content') || '';
        if (!token) {
            this.initCsrfToken();
            const updatedMeta = document.querySelector('meta[name="csrf-token"]');
            if (updatedMeta) {
                return updatedMeta.getAttribute('content') || '';
            }
        }
        return token;
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
        const csrfToken = this.getCsrfToken();
        if (csrfToken) {
            headers['X-CSRF-TOKEN'] = csrfToken;
        }

        if (includeAuth) {
            const authToken = this.getAuthToken();
            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }
        }

        return Object.assign(headers, customHeaders);
    }

    async request(url, options = {}) {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { message: errorText || 'Request failed', status: response.status };
            }
            throw new Error(errorData.message || 'Request failed');
        }
        return response.json();
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
        try {
            const response = await fetch('/csrf-token');
            const data = await response.json();
            let metaTag = document.querySelector('meta[name="csrf-token"]');
            if (metaTag) {
                metaTag.setAttribute('content', data.csrf_token);
            } else {
                metaTag = document.createElement('meta');
                metaTag.name = 'csrf-token';
                metaTag.setAttribute('content', data.csrf_token);
                document.head.appendChild(metaTag);
            }
            this.csrfToken = data.csrf_token;
        } catch (error) {
            console.error('Failed to initialize CSRF token:', error);
        }
    }
}

// API Endpoint URL Keys
ApiClient.PointUrlKey = {
    // System API
    API_INFO: '/api_info',
    API_HEADERS_CACHE_SAVE: '/api_headers_cache/save',
    API_HEADERS_CACHE_RESET: '/api_headers_cache/reset',
    API_PARAMS_CACHE_SAVE: '/api_params_cache/save',
    API_PARAMS_CACHE_LOAD: '/api_params_cache/load',

    // Templates
    TEMPLATE_API_ITEM: '/debug-assets/debug-tools/templates/api-item.html',
    TEMPLATE_FEATURE_DOCS: '/debug-assets/debug-tools/templates/feature-docs.html',
    TEMPLATE_SHARED_HEADER_ITEM: '/debug-assets/debug-tools/templates/shared-header-item.html',
    TEMPLATE_SHARED_HEADERS_SECTION: '/debug-assets/debug-tools/templates/shared-headers-section.html',

    // ITTools Crypto
    ITTOOLS_CRYPTO_BCRYPT_HASH: '/api/ittools/v1/crypto/bcrypt/hash',
    ITTOOLS_CRYPTO_BCRYPT_VERIFY: '/api/ittools/v1/crypto/bcrypt/verify',
    ITTOOLS_CRYPTO_ULID_GENERATE: '/api/ittools/v1/crypto/ulid/generate',
    ITTOOLS_CRYPTO_BIP39_GENERATE: '/api/ittools/v1/crypto/bip39/generate',

    // ITTools Converters
    ITTOOLS_CONVERTER_JSON_YAML: '/api/ittools/v1/converter/json-to-yaml',
    ITTOOLS_CONVERTER_YAML_JSON: '/api/ittools/v1/converter/yaml-to-json',

    // ITTools Formatters
    ITTOOLS_FORMAT_XML: '/api/ittools/v1/web/xml/format',
    ITTOOLS_FORMAT_YAML: '/api/ittools/v1/web/yaml/format',
    ITTOOLS_FORMAT_SQL: '/api/ittools/v1/web/sql/format',

    // ITTools Web
    ITTOOLS_WEB_MARKDOWN_HTML: '/api/ittools/v1/web/markdown/to-html',

    // ITTools Image
    ITTOOLS_IMAGE_COMPRESS: '/api/ittools/v1/advanced/image/compress',
    ITTOOLS_IMAGE_CROP: '/api/ittools/v1/advanced/image/crop',

    // ITTools PDF
    ITTOOLS_PDF_SPLIT: '/api/ittools/v1/advanced/pdf/split',

    // Clipboard
    CLIPBOARD_NAMESPACE: '/clipboard/namespace',
    CLIPBOARD_DATA: '/clipboard/data',
    CLIPBOARD_TEXT: '/clipboard/text',
    CLIPBOARD_UPLOAD: '/clipboard/upload',
    CLIPBOARD_DELETE_FILE: '/clipboard/delete-file',
    CLIPBOARD_NEW: '/clipboard/new',
    CLIPBOARD_RESTORE: '/clipboard/restore',

    // MCP Task Dispatch
    MCP_TASK_CATEGORIES_FILES: '/api/mcp/v1/task-dispatch/categories',
    MCP_TASK_QUEUE_ADD: '/api/mcp/v1/task-dispatch/queue/add-file',

    // Code Browser
    CODE_BROWSER_READ_FILE: '/code-browser/read-file',
    CODE_BROWSER_SAVE_FILE: '/code-browser/save-file',
    CODE_BROWSER_DELETE_FILE: '/code-browser/delete-file',
    CODE_BROWSER_PROMPTS_TRANSLATE_LINE: '/code-browser/prompts/translate-line',
    CODE_BROWSER_PROMPTS_TRANSLATE_NAME: '/code-browser/prompts/translate-name',
    CODE_BROWSER_PROMPTS_CREATE: '/code-browser/prompts/create',

    // Static Resources
    STATIC_FILE_TREE: '/static-resources/file-tree',
    STATIC_READ_FILE: '/static-resources/read-file',
    STATIC_STREAM_FILE: '/static-resources/stream-file',
    STATIC_DELETE_PREVIEW: '/static-resources/delete-preview',
    STATIC_DELETE: '/static-resources/delete',
    STATIC_UPLOAD: '/static-resources/upload',
    STATIC_RENAME: '/static-resources/rename',
    STATIC_CREATE_DIRECTORY: '/static-resources/create-directory',
    STATIC_CHUNKED_UPLOAD_INIT: '/static-resources/chunked-upload/init',
    STATIC_CHUNKED_UPLOAD_CHUNK: '/static-resources/chunked-upload/chunk',
    STATIC_CHUNKED_UPLOAD_MERGE: '/static-resources/chunked-upload/merge',

    // TTS
    TTS_GENERATE: '/tts/generate',

    // Translation
    TRANSLATION_GOOGLE: '/translation/simple/google',

    // Dashboard Database Viewer (auth required)
    DB_VIEWER_TABLES: '/api/dashboard/db-viewer/tables'
};

const apiClientInstance = new ApiClient();

apiClientInstance.initCsrfToken();

window.ApiClient = ApiClient;
window.apiClientInstance = apiClientInstance;
