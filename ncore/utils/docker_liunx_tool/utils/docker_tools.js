import { getMirrors } from '../providor/mirrors.js'; // Adjust the path if necessary
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// File to cache the test results
const cacheFile = path.join(__dirname, 'mirrors_cache.json');
// Cache expiration time in milliseconds (e.g., 24 hours)
const cacheTimeout = 24 * 60 * 60 * 1000;

/**
 * Test a single URL with a timeout of 5 seconds
 * @param {string} url - The URL to test
 * @returns {Promise<boolean>} - Returns true if the URL is reachable
 */
async function testUrl(url) {
    try {
        console.log(`Testing URL: ${url}`);
        const { stdout, stderr } = await execPromise(`curl -m 5 -s -o /dev/null -w "%{http_code}" ${url}`);
        const success = stdout.trim() === '200';
        console.log(`Result for ${url}: ${success ? 'Success' : 'Failure'}`);
        return success;
    } catch (error) {
        console.log(`Error testing ${url}: ${error.message}`);
        return false;
    }
}

/**
 * Get available URLs, with caching and network testing
 * @returns {Promise<string[]>} - Returns the list of available URLs
 */
async function getAvailableUrls() {
    // Check if cache exists and is valid
    if (fs.existsSync(cacheFile)) {
        const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        const now = Date.now();
        if (now - cacheData.timestamp < cacheTimeout) {
            console.log('Returning URLs from cache');
            return cacheData.urls;
        }
    }

    // If cache is invalid or does not exist, test the URLs
    const mirrors = getMirrors();
    const availableUrls = [];
    for (const url of mirrors) {
        if (await testUrl(url)) {
            availableUrls.push(url);
        }
    }

    // Cache the results
    fs.writeFileSync(cacheFile, JSON.stringify({ timestamp: Date.now(), urls: availableUrls }, null, 2));
    return availableUrls;
}

export { getAvailableUrls };
