import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';

const PROXY_URLS = [
    "https://github.com.cnpmjs.org",
    "https://hub.fastgit.org",
    "https://gh.api.99988866.xyz",
    "https://g.ioiox.com",
    "http://toolwa.com/github",
    "https://github.zhlh6.cn",
    "https://raw.staticdn.net",
    "https://ghproxy.com"
];

const SPEED_THRESHOLD = 200 * 1024; // 200KB/s
const TEST_DURATION = 5; // 5 seconds
const GLOBAL_VAR_DIR = '/usr/core_node/global_var';

/**
 * Format bytes to human readable format
 * @param {number} bytes - Bytes to format
 * @returns {string} - Formatted string
 */
function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format speed to human readable format
 * @param {number} bytesPerSecond - Speed in bytes per second
 * @returns {string} - Formatted string
 */
function formatSpeed(bytesPerSecond) {
    return `${formatBytes(bytesPerSecond)}/s`;
}

/**
 * Ensure URL ends with '/'
 * @param {string} url - URL to check
 * @returns {string} - URL with trailing slash
 */
function ensureTrailingSlash(url) {
    if (!url) return '';
    return url.endsWith('/') ? url : `${url}/`;
}

/**
 * Check if the file is a valid binary file (not an HTML page)
 * @param {Buffer} fileData - The data to check
 * @returns {boolean} - True if binary, false if HTML or 404
 */
function isValidBinaryFile(fileData) {
    const fileSize = fileData.length;
    
    // If file size is smaller than 1MB, likely a 404 page or similar
    if (fileSize < 1024 * 1024) {
        return false;
    }

    // Return true if it's likely a binary file
    return true;
}

/**
 * Test download speed for a URL using built-in HTTP/HTTPS
 * @param {string} url - URL to test
 * @returns {Promise<{speed: number, error: string|null}>}
 */
async function testProxySpeed(url) {
    console.log(`Testing URL: ${url}`);

    const startTime = Date.now();
    let speed = 0;
    let dataReceived = 0;
    let error = null;
    let fileData = null;

    // Choose HTTP or HTTPS based on the URL
    const protocol = url.startsWith('https') ? https : http;

    try {
        return new Promise((resolve) => {
            const req = protocol.get(url, (res) => {
                if (res.statusCode === 404) {
                    error = '404 Not Found';
                    resolve({ speed: 0, error });
                    return;
                }

                res.on('data', (chunk) => {
                    dataReceived += chunk.length;
                    if (!fileData) fileData = chunk;
                    else fileData = Buffer.concat([fileData, chunk]);
                });

                res.on('end', () => {
                    const duration = (Date.now() - startTime) / 1000; // in seconds
                    speed = dataReceived / duration; // bytes per second
                    console.log(`Duration: ${duration.toFixed(2)}s`);
                    console.log(`Average speed: ${formatSpeed(speed)}`);

                    // Check if the file is valid (not HTML and sufficiently large)
                    if (fileData && isValidBinaryFile(fileData)) {
                        resolve({ speed, error: null });
                    } else {
                        error = 'Invalid or HTML file detected';
                        resolve({ speed: 0, error });
                    }
                });
            });

            req.on('error', (err) => {
                error = err.message;
                resolve({ speed: 0, error });
            });

            req.setTimeout(TEST_DURATION * 1000, () => {
                error = 'Request timeout';
                req.abort();
                resolve({ speed: 0, error });
            });
        });
    } catch (err) {
        console.error(`Error testing ${url}:`, err.message);
        return { speed: 0, error: err.message };
    }
}

/**
 * Save result to global variable directory
 * @param {string} url - URL to save
 */
function saveResult(url) {
    try {
        if (!fs.existsSync(GLOBAL_VAR_DIR)) {
            fs.mkdirSync(GLOBAL_VAR_DIR, { recursive: true });
        }

        const finalUrl = url ? ensureTrailingSlash(url) : '';
        fs.writeFileSync(
            path.join(GLOBAL_VAR_DIR, 'GITHUB_PROXY_URL'),
            finalUrl,
            'utf8'
        );
        console.log(`\nProxy URL saved to ${GLOBAL_VAR_DIR}/GITHUB_PROXY_URL: ${finalUrl || '(empty - using direct connection)'}`);
    } catch (error) {
        console.error('Error saving result:', error.message);
    }
}

/**
 * Main function to test proxies
 * @param {string} targetUrl - Target GitHub URL to test
 */
async function main(targetUrl) {
    if (!targetUrl) {
        console.error('Please provide a GitHub URL to test');
        process.exit(1);
    }

    console.log('GitHub Proxy Speed Test');
    console.log('======================');
    console.log(`Target URL: ${targetUrl}`);
    console.log(`Speed threshold: ${formatSpeed(SPEED_THRESHOLD)}`);
    console.log(`Test duration per URL: ${TEST_DURATION} seconds`);
    console.log('======================\n');

    // First test the original GitHub URL
    console.log('\nTesting direct GitHub connection...');
    const directResult = await testProxySpeed(targetUrl);
    
    // If direct connection is fast enough, use it
    if (directResult.speed > SPEED_THRESHOLD) {
        console.log('\nDirect GitHub connection is fast enough!');
        saveResult(''); // Save empty string to indicate direct connection
        return;
    }

    let fastestProxy = {
        url: '',
        speed: directResult.speed // Start with direct connection speed
    };

    // Test proxy URLs if direct connection wasn't fast enough
    for (const proxyUrl of PROXY_URLS) {
        console.log('\n-------------------');
        const proxyTargetUrl = `${proxyUrl}/` + targetUrl;
        const result = await testProxySpeed(proxyTargetUrl);
        
        if (!result.error && result.speed > fastestProxy.speed) {
            fastestProxy = {
                url: proxyUrl,
                speed: result.speed
            };
        }

        // If speed is above threshold, stop testing
        if (result.speed > SPEED_THRESHOLD) {
            console.log(`\nFound proxy with speed above threshold (${formatSpeed(SPEED_THRESHOLD)})`);
            break;
        }
    }

    console.log('\n======================');
    console.log('Test Results');
    console.log('======================');
    if (fastestProxy.url) {
        console.log(`Fastest proxy: ${fastestProxy.url}`);
        console.log(`Speed: ${formatSpeed(fastestProxy.speed)}`);
        saveResult(fastestProxy.url);
    } else {
        console.log('No working proxy found, using direct connection');
        saveResult('');
    }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const targetUrl = process.argv[2] || 'https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64';
    main(targetUrl).catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
}

export { testProxySpeed, formatSpeed, formatBytes };
