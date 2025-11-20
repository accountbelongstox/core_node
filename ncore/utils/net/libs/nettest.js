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
 * Network testing utilities
 */
const http = require('http');
const https = require('https');
const { URL } = require('url');
const logger = require('#@logger');
const { generateHeaders } = require('../unit/header');

/**
 * Tests if a URL is accessible
 * @param {string} url - The URL to test
 * @param {Object} options - Options for the request
 * @param {number} [options.timeout=5000] - Timeout in milliseconds
 * @param {string} [options.method='HEAD'] - HTTP method to use
 * @param {Object} [options.headers] - Custom headers to use
 * @param {boolean} [options.followRedirects=true] - Whether to follow redirects
 * @param {number} [options.maxRedirects=5] - Maximum number of redirects to follow
 * @returns {Promise<{success: boolean, statusCode: number|null, error: Error|null, responseTime: number, redirects: number}>}
 */
async function isUrlAccessible(url, options = {}) {
    const {
        timeout = 5000,
        method = 'HEAD',
        headers,
        followRedirects = true,
        maxRedirects = 5
    } = options;

    const startTime = Date.now();
    let redirectCount = 0;

    // Function to make the actual request
    const makeRequest = (currentUrl, redirectsLeft) => {
        return new Promise((resolve) => {
            try {
                // Parse the URL
                const parsedUrl = new URL(currentUrl);

                // Choose the appropriate protocol
                const protocol = parsedUrl.protocol === 'https:' ? https : http;

                // Create request options
                const requestOptions = {
                    hostname: parsedUrl.hostname,
                    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                    path: parsedUrl.pathname + parsedUrl.search,
                    method: method,
                    timeout: timeout,
                    headers: headers || generateHeaders()
                };

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

                    // Consider any 2xx status code as success
                    const success = res.statusCode >= 200 && res.statusCode < 300;

                    // For GET requests, consume the response body
                    if (method === 'GET') {
                        let responseBody = '';
                        res.on('data', (chunk) => {
                            responseBody += chunk;
                        });

                        res.on('end', () => {
                            resolve({
                                success,
                                statusCode: res.statusCode,
                                error: null,
                                responseTime,
                                redirects: redirectCount,
                                headers: res.headers,
                                body: responseBody
                            });
                        });
                    } else {
                        resolve({
                            success,
                            statusCode: res.statusCode,
                            error: null,
                            responseTime,
                            redirects: redirectCount,
                            headers: res.headers
                        });
                    }
                });

                // Handle request errors
                req.on('error', (error) => {
                    const responseTime = Date.now() - startTime;
                    logger.error(`URL connectivity test failed: ${error.message}`);

                    resolve({
                        success: false,
                        statusCode: null,
                        error,
                        responseTime,
                        redirects: redirectCount
                    });
                });

                // Handle timeout
                req.on('timeout', () => {
                    req.destroy();
                    const responseTime = Date.now() - startTime;
                    logger.warn(`URL connectivity test timed out after ${timeout}ms`);

                    resolve({
                        success: false,
                        statusCode: null,
                        error: new Error(`Request timeout after ${timeout}ms`),
                        responseTime,
                        redirects: redirectCount
                    });
                });

                // End the request
                req.end();

            } catch (error) {
                const responseTime = Date.now() - startTime;
                logger.error(`URL connectivity test failed: ${error.message}`);

                resolve({
                    success: false,
                    statusCode: null,
                    error,
                    responseTime,
                    redirects: redirectCount
                });
            }
        });
    };

    return makeRequest(url, maxRedirects);
}

/**
 * Fetch full response from a URL
 * @param {string} url - The URL to fetch
 * @param {Object} options - Options for the request
 * @param {number} [options.timeout=10000] - Timeout in milliseconds
 * @param {Object} [options.headers] - Custom headers to use
 * @param {boolean} [options.followRedirects=true] - Whether to follow redirects
 * @param {number} [options.maxRedirects=5] - Maximum number of redirects to follow
 * @returns {Promise<{success: boolean, statusCode: number|null, error: Error|null, responseTime: number, body: string, headers: Object}>}
 */
async function fetchUrl(url, options = {}) {
    return isUrlAccessible(url, {
        method: 'GET',
        timeout: 10000,
        ...options
    });
}

/**
 * Simple check if a URL is accessible
 * @param {string} url - The URL to test
 * @param {Object} options - Options for the request
 * @param {number} [options.timeout=5000] - Timeout in milliseconds
 * @param {Object} [options.headers] - Custom headers to use
 * @returns {Promise<boolean>} - Returns true if the URL is accessible
 */
async function canAccess(url, options = {}) {
    const result = await isUrlAccessible(url, options);
    return result.success;
}

module.exports = {
    isUrlAccessible,
    fetchUrl,
    canAccess
};
