const APIClient = {
    getCsrfToken() {
        return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    },
    getAuthToken() {
        return '22|KbgNC0HXT6k7ZUsTJWCIBhl9PvZctRjdpWIo3EKm4ebca095';
    },
    buildHeaders(customHeaders = {}, includeAuth = true, isFormData = false) {
        const headers = {};
        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }
        headers['Accept'] = 'application/json';
        headers['X-CSRF-TOKEN'] = this.getCsrfToken();
        if (includeAuth) {
            const authToken = this.getAuthToken();
            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }
        }
        return { ...headers, ...customHeaders };
    },
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
        return fetch(url, requestOptions);
    },
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
            console.error('Failed to load CSRF token:', error);
        }
    }
};

async function init() {
    await APIClient.initCsrfToken();
    document.getElementById('result').textContent = 'Ready! CSRF Token: ' + APIClient.getCsrfToken();
}

async function testAutoRename() {
    try {
        const response = await APIClient.post('/code-browser/auto-rename-to-english', {
            path: '_prompts/测试文件.md'
        });
        const data = await response.json();
        document.getElementById('result').textContent = JSON.stringify(data, null, 2);
    } catch (error) {
        document.getElementById('result').textContent = 'Error: ' + error.message;
    }
}

init();
