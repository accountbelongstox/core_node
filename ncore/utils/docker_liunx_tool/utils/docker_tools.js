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

const { getMirrors } = require('../providor/mirrors.js'); // Adjust the path if necessary
    const fs = require('fs');
    const path = require('path');
    const { exec } = require('child_process');
    const util = require('util');

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

    module.exports = { getAvailableUrls };