// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

/**
 * HTTP Requests Utility
 * Provides easy-to-use methods for making HTTP requests with consistent header management
 */
const http = require('http');
const https = require('https');
const { URL } = require('url');
const { promisify } = require('util');
const querystring = require('querystring');
const { createBrowserHeaders, createApiHeaders } = require('../unit/header');

let logger = require('#@logger');

/**
 * Makes an HTTP/HTTPS request
 * @param {string} url - The URL to request
 * @param {Object} options - Request options
 * @param {string} [options.method='GET'] - HTTP method
 * @param {Object} [options.headers] - HTTP headers
 * @param {Object|string} [options.body] - Request body (for POST, PUT, etc.)
 * @param {string} [options.bodyType='json'] - Body type: 'json', 'form', 'text'
 * @param {number} [options.timeout=30000] - Request timeout in milliseconds
 * @param {boolean} [options.followRedirects=true] - Whether to follow redirects
 * @param {number} [options.maxRedirects=5] - Maximum number of redirects to follow
 * @param {boolean} [options.validateStatus=true] - Whether to validate status code
 * @param {Function} [options.validateFn] - Custom status validation function
 * @returns {Promise<Object>} - Response object with status, headers, data, etc.
 */
async function request(url, options = {}) {
    const {
        method = 'GET',
        headers = {},
        body,
        bodyType = 'json',
        timeout = 300000,
        followRedirects = true,
        maxRedirects = 5,
        validateStatus = true,
        validateFn = (status) => status >= 200 && status < 300
    } = options;

    const startTime = Date.now();
    let redirectCount = 0;

    // Function to make the actual request
    const makeRequest = (currentUrl, redirectsLeft, retryCount = 0) => {
        return new Promise((resolve) => {
            try {
                // Parse the URL
                const parsedUrl = new URL(currentUrl);

                // Choose the appropriate protocol
                const protocol = parsedUrl.protocol === 'https:' ? https : http;

                // Prepare the request body if needed
                let requestBody = undefined;
                let requestHeaders = { ...headers };

                if (body !== undefined) {
                    if (bodyType === 'json') {
                        requestBody = JSON.stringify(body);
                        requestHeaders['Content-Type'] = 'application/json';
                    } else if (bodyType === 'form') {
                        requestBody = typeof body === 'string' ? body : querystring.stringify(body);
                        requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
                    } else {
                        requestBody = String(body);
                    }

                    requestHeaders['Content-Length'] = Buffer.byteLength(requestBody);
                }

                // Create request options
                const requestOptions = {
                    hostname: parsedUrl.hostname,
                    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                    path: parsedUrl.pathname + parsedUrl.search,
                    method: method,
                    headers: requestHeaders,
                    timeout: timeout
                };

                logger.debug(`[${method}] Requesting: ${currentUrl}`);

                // Create the request
                const req = protocol.request(requestOptions, (res) => {
                    const responseTime = Date.now() - startTime;

                    // Handle redirects if enabled
                    if (followRedirects &&
                        redirectsLeft > 0 &&
                        (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308)) {

                        const location = res.headers.location;
                        if (location) {
                            // Resolve relative URLs
                            const redirectUrl = new URL(location, currentUrl).href;
                            redirectCount++;

                            logger.debug(`Following redirect (${redirectCount}/${maxRedirects}) to: ${redirectUrl}`);
                            return makeRequest(redirectUrl, redirectsLeft - 1)
                                .then(resolve);
                        }
                    }

                    // Collect response data
                    let responseBody = '';
                    const responseBuffers = [];

                    res.on('data', (chunk) => {
                        responseBuffers.push(chunk);
                        responseBody += chunk;
                    });

                    res.on('end', () => {
                        const buffer = Buffer.concat(responseBuffers);

                        // Parse JSON if the response is JSON
                        let parsedData;
                        const contentType = res.headers['content-type'] || '';

                        if (contentType.includes('application/json')) {
                            try {
                                parsedData = JSON.parse(responseBody);
                            } catch (error) {
                                logger.warn(`Failed to parse JSON response: ${error.message}`);
                                parsedData = null;
                            }
                        }

                        // Create response object
                        const response = {
                            url: currentUrl,
                            status: res.statusCode,
                            statusText: res.statusMessage,
                            headers: res.headers,
                            data: parsedData || responseBody,
                            buffer: buffer,
                            responseTime,
                            redirects: redirectCount,
                            ok: validateFn(res.statusCode)
                        };

                        // Validate status if required
                        if (validateStatus && !response.ok) {
                            console.log(res);
                            logger.error(res.statusCode);
                            logger.error(res.statusMessage);

                        }

                        resolve(response);
                    });
                });

                // Handle request errors
                req.on('error', (error) => {
                    const responseTime = Date.now() - startTime;
                    logger.error(`Request failed: ${error.message}`);

                    resolve({
                        url: currentUrl,
                        status: 0,
                        statusText: error.message,
                        headers: {},
                        data: null,
                        buffer: Buffer.alloc(0),
                        responseTime,
                        redirects: redirectCount,
                        ok: false,
                        error
                    });
                });

                // Handle timeout
                req.on('timeout', () => {
                    req.destroy();
                    const responseTime = Date.now() - startTime;
                    logger.warn(`Request timed out after ${timeout}ms`);

                    resolve({
                        url: currentUrl,
                        status: 0,
                        statusText: 'Timeout',
                        headers: {},
                        data: null,
                        buffer: Buffer.alloc(0),
                        responseTime,
                        redirects: redirectCount,
                        ok: false,
                        error: new Error(`Request timeout after ${timeout}ms`)
                    });
                });

                // Send the request body if provided
                if (requestBody) {
                    req.write(requestBody);
                }

                // End the request
                req.end();

            } catch (error) {
                const responseTime = Date.now() - startTime;
                logger.error(`Request failed: ${error.message}`);

                resolve({
                    url: currentUrl,
                    status: 0,
                    statusText: error.message,
                    headers: {},
                    data: null,
                    buffer: Buffer.alloc(0),
                    responseTime,
                    redirects: redirectCount,
                    ok: false,
                    error
                });
            }
        });
    };

    return makeRequest(url, maxRedirects);
}

/**
 * Makes a GET request
 * @param {string} url - The URL to request
 * @param {Object} options - Request options
 * @param {Object} [options.params] - Query parameters to append to the URL
 * @param {Object} [options.headers] - HTTP headers
 * @param {string} [options.responseType='json'] - Expected response type
 * @param {number} [options.timeout=30000] - Request timeout in milliseconds
 * @param {boolean} [options.browserLike=false] - Use browser-like headers
 * @returns {Promise<Object>} - Response object
 */
async function get(url, options = {}) {
    const {
        params,
        headers = {},
        responseType = 'json',
        timeout = 300000,
        browserLike = false,
        ...restOptions
    } = options;

    // Add query parameters if provided
    let finalUrl = url;
    if (params) {
        const parsedUrl = new URL(url);
        const searchParams = new URLSearchParams(parsedUrl.search);

        for (const [key, value] of Object.entries(params)) {
            searchParams.append(key, value);
        }

        parsedUrl.search = searchParams.toString();
        finalUrl = parsedUrl.toString();
    }

    // Prepare headers
    let requestHeaders = { ...headers };
    if (browserLike) {
        requestHeaders = {
            ...createBrowserHeaders(),
            ...headers
        };
    }
    let responseData = {}
    try {
        responseData = await request(finalUrl, {
            method: 'GET',
            headers: requestHeaders,
            timeout,
            ...restOptions
        });
    } catch (error) {
        showError(error, null, options);
    }
    return extraData(responseData);
}

/**
 * Makes a POST request
 * @param {string} url - The URL to request
 * @param {Object|string} data - Data to send in the request body
 * @param {Object} options - Request options
 * @param {string} [options.bodyType='json'] - Body type: 'json', 'form', 'text'
 * @param {Object} [options.headers] - HTTP headers
 * @param {string} [options.responseType='json'] - Expected response type
 * @param {number} [options.timeout=30000] - Request timeout in milliseconds
 * @param {boolean} [options.apiStyle=false] - Use API-style headers
 * @returns {Promise<Object>} - Response object
 */
async function post(url, data, options = {}) {
    const {
        bodyType = 'json',
        headers = {},
        responseType = 'json',
        timeout = 300000,
        apiStyle = false,
        ...restOptions
    } = options;

    // Prepare headers
    let requestHeaders = { ...headers };
    if (apiStyle) {
        requestHeaders = {
            ...createApiHeaders(),
            ...headers
        };
    }
    let requestData = {}
    try {
        requestData = await request(url, {
            method: 'POST',
            headers: requestHeaders,
            body: data,
            bodyType,
            timeout,
            ...restOptions
        });
    } catch (error) {
        showError(error, data, options);
    }
    return extraData(requestData);
}

/**
 * Makes a PUT request
 * @param {string} url - The URL to request
 * @param {Object|string} data - Data to send in the request body
 * @param {Object} options - Request options
 * @returns {Promise<Object>} - Response object
 */
async function put(url, data, options = {}) {
    let responseData = {}
    let requestData = {}
    try {
        requestData = await request(url, {
            method: 'PUT',
            body: data,
            ...options
        });
    } catch (error) {
        showError(error, data, options);
    }
    if (requestData.data) {
        responseData = requestData.data;
    }
    return responseData;
}

function extraData(requestData) {
    let responseData = {}
    if (requestData.data) {
        responseData = requestData.data;
    } else {
        console.log(requestData);
        logger.error(`Request failed: ${requestData.statusText}`);
        
    }
    return responseData;
}

function showError(error, data, options) {showError
    logger.error(`----------------------------------------------------`);
    console.log(data);
    console.log(options);
    logger.error(`Request failed: ${error}`);
    logger.error(`----------------------------------------------------`);
}

/**
 * Makes a DELETE request
 * @param {string} url - The URL to request
 * @param {Object} options - Request options
 * @returns {Promise<Object>} - Response object
 */
async function del(url, options = {}) {
    let responseData = {}
    try {
        responseData = await request(url, {
            method: 'DELETE',
            ...options
        });
    } catch (error) {
        showError(error, null, options);
    }
    return extraData(responseData);
}

/**
 * Makes a PATCH request
 * @param {string} url - The URL to request
 * @param {Object|string} data - Data to send in the request body
 * @param {Object} options - Request options
 * @returns {Promise<Object>} - Response object
 */
async function patch(url, data, options = {}) {
    let responseData = {}
    try {
        responseData = await request(url, {
            method: 'PATCH',
            body: data,
            ...options
        });
    } catch (error) {
        showError(error, data, options);
    }
    return extraData(responseData);
}

/**
 * Makes a HEAD request
 * @param {string} url - The URL to request
 * @param {Object} options - Request options
 * @returns {Promise<Object>} - Response object with headers but no body
 */
async function head(url, options = {}) {
    return request(url, {
        method: 'HEAD',
        ...options
    });
}

/**
 * Creates a request client with default options
 * @param {Object} defaultOptions - Default options for all requests
 * @returns {Object} - Client object with request methods
 */
function createClient(defaultOptions = {}) {
    return {
        request: (url, options) => request(url, { ...defaultOptions, ...options }),
        get: (url, options) => get(url, { ...defaultOptions, ...options }),
        post: (url, data, options) => post(url, data, { ...defaultOptions, ...options }),
        put: (url, data, options) => put(url, data, { ...defaultOptions, ...options }),
        delete: (url, options) => del(url, { ...defaultOptions, ...options }),
        patch: (url, data, options) => patch(url, data, { ...defaultOptions, ...options }),
        head: (url, options) => head(url, { ...defaultOptions, ...options })
    };
}

module.exports = {
    request,
    get,
    post,
    put,
    delete: del,
    patch,
    head,
    createClient
};
