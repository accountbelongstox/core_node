import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

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
const GLOBAL_VAR_DIR = '/usr/script_global_var';

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
 * Test download speed for a URL
 * @param {string} url - URL to test
 * @returns {Promise<{speed: number, error: string|null}>}
 */
async function testProxySpeed(url) {
    console.log(`Testing URL: ${url}`);

    try {
        const startTime = Date.now();
        const result = execSync(
            `curl -L --max-time ${TEST_DURATION} "${url}" -w "%{speed_download}" -o /dev/null -s`,
            { encoding: 'utf8' }
        );
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        const speed = parseFloat(result);

        console.log(`Duration: ${duration.toFixed(2)}s`);
        console.log(`Average speed: ${formatSpeed(speed)}`);
        
        return { speed, error: null };
    } catch (error) {
        console.error(`Error testing ${url}:`, error.message);
        return { speed: 0, error: error.message };
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