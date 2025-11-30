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

'use strict';

const logger = require('#@logger');

class ScriptInjectionUtils {
    constructor(page) {
        this.page = page;
    }

    async injectScript(script, options = {}) {
        const timeout = options.timeout || 30000;
        const args = options.args || [];

        try {
            const result = await Promise.race([
                this.page.evaluate(script, ...args),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Script injection timeout')), timeout)
                )
            ]);
            logger.debug('Script injected successfully');
            return result;
        } catch (error) {
            logger.error('Failed to inject script:', error);
            throw error;
        }
    }

    async injectFetchRequest(url, options = {}) {
        const method = options.method || 'GET';
        const headers = options.headers || {};
        const body = options.body;
        const timeout = options.timeout || 30000;
        const responseType = options.responseType || 'json';

        const injectionCode = async (url, method, headers, body, responseType) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            try {
                const fetchOptions = {
                    method: method,
                    headers: headers,
                    signal: controller.signal
                };

                if (body && method !== 'GET' && method !== 'HEAD') {
                    fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
                }

                const response = await fetch(url, fetchOptions);
                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                let data;
                const contentType = response.headers.get('content-type') || '';

                if (responseType === 'json' || contentType.includes('application/json')) {
                    data = await response.json();
                } else if (responseType === 'text' || contentType.includes('text/')) {
                    data = await response.text();
                } else if (responseType === 'blob' || responseType === 'binary') {
                    const blob = await response.blob();
                    const arrayBuffer = await blob.arrayBuffer();
                    data = Array.from(new Uint8Array(arrayBuffer));
                } else if (responseType === 'arrayBuffer') {
                    const arrayBuffer = await response.arrayBuffer();
                    data = Array.from(new Uint8Array(arrayBuffer));
                } else {
                    data = await response.text();
                }

                return {
                    success: true,
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                    contentType: contentType,
                    data: data
                };
            } catch (error) {
                clearTimeout(timeoutId);
                return {
                    success: false,
                    error: error.message,
                    name: error.name
                };
            }
        };

        try {
            const result = await Promise.race([
                this.page.evaluate(
                    injectionCode,
                    url,
                    method,
                    headers,
                    body,
                    responseType
                ),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Fetch injection timeout')), timeout)
                )
            ]);

            if (!result.success) {
                throw new Error(result.error || 'Fetch failed');
            }

            return result;
        } catch (error) {
            logger.error(`Failed to inject fetch request for ${url}:`, error);
            throw error;
        }
    }

    async injectXMLHttpRequest(url, options = {}) {
        const method = options.method || 'GET';
        const headers = options.headers || {};
        const body = options.body;
        const timeout = options.timeout || 30000;
        const responseType = options.responseType || 'json';

        const injectionCode = (url, method, headers, body, responseType, timeout) => {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open(method, url, true);
                xhr.timeout = timeout;

                if (responseType === 'json') {
                    xhr.responseType = 'text';
                } else if (responseType === 'binary' || responseType === 'arrayBuffer') {
                    xhr.responseType = 'arraybuffer';
                } else {
                    xhr.responseType = responseType;
                }

                Object.keys(headers).forEach(key => {
                    xhr.setRequestHeader(key, headers[key]);
                });

                xhr.onload = function() {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        let data = xhr.response;

                        if (responseType === 'json') {
                            try {
                                data = JSON.parse(xhr.responseText);
                            } catch (e) {
                                data = xhr.responseText;
                            }
                        } else if (xhr.responseType === 'arraybuffer') {
                            data = Array.from(new Uint8Array(xhr.response));
                        }

                        resolve({
                            success: true,
                            status: xhr.status,
                            statusText: xhr.statusText,
                            headers: xhr.getAllResponseHeaders(),
                            data: data
                        });
                    } else {
                        reject({
                            success: false,
                            error: `HTTP ${xhr.status}: ${xhr.statusText}`,
                            status: xhr.status
                        });
                    }
                };

                xhr.onerror = function() {
                    reject({
                        success: false,
                        error: 'Network error occurred'
                    });
                };

                xhr.ontimeout = function() {
                    reject({
                        success: false,
                        error: 'Request timeout'
                    });
                };

                if (body && method !== 'GET' && method !== 'HEAD') {
                    xhr.send(typeof body === 'string' ? body : JSON.stringify(body));
                } else {
                    xhr.send();
                }
            });
        };

        try {
            const result = await this.page.evaluate(
                injectionCode,
                url,
                method,
                headers,
                body,
                responseType,
                timeout
            );

            return result;
        } catch (error) {
            logger.error(`Failed to inject XMLHttpRequest for ${url}:`, error);
            throw error;
        }
    }

    async injectBase64Decoder() {
        const decoderCode = () => {
            window.__base64ToArrayBuffer = function(base64) {
                const binaryString = window.atob(base64);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                return bytes.buffer;
            };
        };

        return await this.injectScript(decoderCode);
    }

    async evaluateWithTimeout(fn, timeout = 30000, ...args) {
        return await Promise.race([
            this.page.evaluate(fn, ...args),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Evaluation timeout')), timeout)
            )
        ]);
    }

    async injectBatchFetchRequests(urls, options = {}) {
        const method = options.method || 'GET';
        const headers = options.headers || {};
        const timeout = options.timeout || 30000;
        const responseType = options.responseType || 'json';
        const concurrency = options.concurrency || 10;

        logger.info(`[ScriptInjectionUtils] Batch fetching ${urls.length} URLs with concurrency ${concurrency}`);

        const injectionCode = async (urlsArray, method, headers, responseType, concurrency) => {
            const fetchOne = async (url) => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);

                try {
                    const fetchOptions = {
                        method: method,
                        headers: headers,
                        signal: controller.signal
                    };

                    const response = await fetch(url, fetchOptions);
                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    let data;
                    const contentType = response.headers.get('content-type') || '';

                    if (responseType === 'json' || contentType.includes('application/json')) {
                        data = await response.json();
                    } else if (responseType === 'text' || contentType.includes('text/')) {
                        data = await response.text();
                    } else if (responseType === 'blob' || responseType === 'binary') {
                        const blob = await response.blob();
                        const arrayBuffer = await blob.arrayBuffer();
                        data = Array.from(new Uint8Array(arrayBuffer));
                    } else if (responseType === 'arrayBuffer') {
                        const arrayBuffer = await response.arrayBuffer();
                        data = Array.from(new Uint8Array(arrayBuffer));
                    } else {
                        data = await response.text();
                    }

                    return {
                        success: true,
                        url: url,
                        status: response.status,
                        statusText: response.statusText,
                        headers: Object.fromEntries(response.headers.entries()),
                        contentType: contentType,
                        data: data
                    };
                } catch (error) {
                    clearTimeout(timeoutId);
                    return {
                        success: false,
                        url: url,
                        error: error.message,
                        name: error.name
                    };
                }
            };

            const executeWithConcurrency = async (tasks, concurrency) => {
                const results = [];
                const executing = [];

                for (const task of tasks) {
                    const promise = task().then(result => {
                        executing.splice(executing.indexOf(promise), 1);
                        return result;
                    });

                    results.push(promise);
                    executing.push(promise);

                    if (executing.length >= concurrency) {
                        await Promise.race(executing);
                    }
                }

                return await Promise.all(results);
            };

            const tasks = urlsArray.map(url => () => fetchOne(url));
            return await executeWithConcurrency(tasks, concurrency);
        };

        try {
            const results = await Promise.race([
                this.page.evaluate(
                    injectionCode,
                    urls,
                    method,
                    headers,
                    responseType,
                    concurrency
                ),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Batch fetch injection timeout')), timeout)
                )
            ]);

            const successful = results.filter(r => r.success);
            const failed = results.filter(r => !r.success);

            logger.info(`[ScriptInjectionUtils] Batch fetch complete: ${successful.length} success, ${failed.length} failed`);

            return {
                success: true,
                total: results.length,
                successful: successful.length,
                failed: failed.length,
                results: results
            };

        } catch (error) {
            logger.error(`Failed to inject batch fetch requests:`, error);
            throw error;
        }
    }
}

module.exports = ScriptInjectionUtils;
