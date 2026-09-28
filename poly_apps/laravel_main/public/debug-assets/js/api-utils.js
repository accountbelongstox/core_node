/**
 * API Utilities
 * Common API operations and data processing
 * Separates API logic from DOM manipulation
 */

const ApiUtils = {
    /**
     * Parse feature string into structured data
     * @param {string} feature - Feature string
     * @returns {Object} Parsed feature data
     */
    parseFeatureString(feature) {
        const parts = feature.split('|');
        const authAndMethod = parts[0];
        const description = parts[1];
        const controller = parts[2];
        const result = {
            authAndMethod: authAndMethod,
            description: description,
            controller: controller,
            params: {},
            headers: {},
            response: {},
            tags: []
        };

        for (let i = 3; i < parts.length; i++) {
            const section = parts[i];
            if (section.startsWith('params:')) {
                result.params = this.parseParameterSection(section.substring(7));
            } else if (section.startsWith('headers:')) {
                result.headers = this.parseParameterSection(section.substring(8));
            } else if (section.startsWith('response:')) {
                result.response = this.parseParameterSection(section.substring(9));
            } else if (section.startsWith('tags:')) {
                result.tags = section.substring(5).split(',').map(tag => tag.trim());
            }
        }

        return result;
    },

    /**
     * Parse parameter section
     * @param {string} section - Parameter section string
     * @returns {Object} Parsed parameters
     */
    parseParameterSection(section) {
        const params = {};
        const paramList = [];
        let current = '';
        let depth = 0;

        for (let i = 0; i < section.length; i++) {
            const char = section[i];
            if (char === '(') depth++;
            else if (char === ')') depth--;
            else if (char === ',' && depth === 0) {
                paramList.push(current.trim());
                current = '';
                continue;
            }
            current += char;
        }
        paramList.push(current.trim());

        paramList.forEach(param => {
            const parsed = this.parseParameterDefinition(param.trim());
            if (parsed.name) {
                params[parsed.name] = parsed;
            }
        });

        return params;
    },

    /**
     * Parse parameter definition
     * @param {string} paramDef - Parameter definition string
     * @returns {Object} Parsed parameter
     */
    parseParameterDefinition(paramDef) {
        const match = paramDef.match(/^([^(]+)\(([^)]+)\)$/);
        if (!match) {
            return { name: '', type: '', requirement: '', example: '' };
        }
        const parts = match[2].split(',');
        return {
            name: match[1].trim(),
            type: parts[0]?.trim() || '',
            requirement: parts[1]?.trim() || '',
            example: parts[2]?.trim() || ''
        };
    },

    /**
     * Normalize app endpoints into an array of endpoint objects.
     * Accepts sequential arrays, keyed maps, or missing values so callers
     * never iterate a non-array payload.
     * @param {Object|string} appAPIs - App info entry from api_reference
     * @returns {Array<Object>} Endpoint objects
     */
    normalizeEndpoints(appAPIs) {
        if (!appAPIs || typeof appAPIs !== 'object') {
            return [];
        }
        const raw = appAPIs.endpoints;
        if (Array.isArray(raw)) {
            return raw.filter(ep => ep && typeof ep === 'object');
        }
        if (raw && typeof raw === 'object') {
            return Object.values(raw).filter(ep => ep && typeof ep === 'object');
        }
        return [];
    },

    /**
     * Resolve the HTTP method declared for an endpoint.
     * Prefers the explicit method field; falls back to feature string parsing.
     * @param {Object} api - Endpoint object
     * @returns {string} HTTP method
     */
    resolveMethod(api) {
        if (api && typeof api === 'object' && typeof api.method === 'string' && api.method.trim()) {
            return this.extractMethod(api.method);
        }
        return this.extractMethod(api && typeof api.feature === 'string' ? api.feature : '');
    },

    /**
     * Resolve whether an endpoint requires authentication.
     * Prefers the explicit auth_required field; falls back to feature string parsing.
     * @param {Object} api - Endpoint object
     * @returns {boolean} True when authentication is required
     */
    resolveAuthRequired(api) {
        if (api && typeof api === 'object' && typeof api.auth_required === 'boolean') {
            return api.auth_required;
        }
        const feature = api && typeof api.feature === 'string' ? api.feature : '';
        return feature.toLowerCase().includes('auth_required');
    },

    /**
     * Extract HTTP method from feature string
     * @param {string} feature - Feature string
     * @returns {string} HTTP method
     */
    extractMethod(feature) {
        const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
        const upperFeature = feature.toUpperCase();
        if (upperFeature.includes('ANY')) {
            return "POST";
        }
        for (let method of methods) {
            if (upperFeature.includes(method)) {
                return method;
            }
        }
        return "GET";
    },

    /**
     * Extract endpoint from path
     * @param {string} path - Full API path
     * @returns {string} Endpoint path
     */
    extractEndpoint(path) {
        try {
            const url = new URL(path);
            return url.pathname;
        } catch (e) {
            return path;
        }
    },

    /**
     * Generate preset JSON from feature
     * @param {string} feature - Feature string
     * @param {string} method - HTTP method
     * @param {string} appName - Application name
     * @param {Object} cachedHeaders - Cached headers
     * @returns {string} JSON string
     */
    generatePresetJson(feature, method, appName = null, cachedHeaders = {}) {
        const parsed = this.parseFeatureString(feature);
        const jsonParams = {};

        Object.values(parsed.params).forEach(param => {
            const value = param.example;
            const finalValue = this.linkParameterToHeader(param.name, value, cachedHeaders);
            jsonParams[param.name] = finalValue;
        });

        return Object.keys(jsonParams).length > 0 ? JSON.stringify(jsonParams, null, 2) : '';
    },

    /**
     * Link parameter to shared header
     * @param {string} paramName - Parameter name
     * @param {string} paramValue - Parameter value
     * @param {Object} cachedHeaders - Cached headers
     * @returns {string} Final value
     */
    linkParameterToHeader(paramName, paramValue, cachedHeaders) {
        const paramValueStr = String(paramValue);
        const paramHeaderMap = {
            'token': 'Authorization',
            'auth_token': 'Authorization',
            'user_token': 'Authorization',
            'access_token': 'Authorization',
            'bearer_token': 'Authorization',
            'client_token': 'X-Client-Token',
            'api_key': 'X-API-Key',
            'username': 'X-Auth-Username',
            'password': 'X-Auth-Password'
        };

        const headerName = paramHeaderMap[paramName.toLowerCase()];
        const headerValue = cachedHeaders[headerName];
        return headerValue || paramValue;
    },

    /**
     * Format API response for display
     * @param {Object} response - Fetch response object
     * @param {string} bodyText - Response body text
     * @returns {string} Formatted response text
     */
    formatResponse(response, bodyText) {
        let responseText = `Status: ${response.ok ? 'OK' : 'ERROR'} ${response.status} ${response.statusText}\n\n`;
        responseText += `Headers:\n${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}\n\n`;
        responseText += `Response:\n`;

        try {
            const jsonBody = JSON.parse(bodyText);
            responseText += JSON.stringify(jsonBody, null, 2);
        } catch (e) {
            responseText += bodyText;
        }

        return responseText;
    }
};

window.ApiUtils = ApiUtils;

