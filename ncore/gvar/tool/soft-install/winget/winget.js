const fs = require('fs');
const path = require('path');
const parseInstalledPackages = require('./winget_parse_list.js');
const { isWindows, execCmdResultText, pipeExecCmd } = require('../common/cmder.js');
const parseSearchResults = require('./winget_parse_search.js').parseSearchResults;
const { handleCache, updateCache, sortSearchResults } = require('./winget_parse_utils.js');
const os = require('os');
const { normalizeKeywords, calculateMatchScore } = require('./winget_parse_utils.js');

let log;
try {
    const logger = require('#@/ncore/utils/logger/index.js');
    log = {
        info: (...args) => logger.info(...args),
        warn: (...args) => logger.warn(...args),
        error: (...args) => logger.error(...args),
        success: (...args) => logger.success(...args),
        debug: (...args) => logger.debug ? logger.debug(...args) : console.log('[DEBUG]', ...args),
        command: (...args) => logger.command(...args)
    };
} catch (error) {
    log = {
        info: (...args) => console.log('[INFO]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        success: (...args) => console.log('[SUCCESS]', ...args),
        debug: (...args) => console.log('[DEBUG]', ...args),
        command: (...args) => console.log('[COMMAND]', ...args)
    };
}

let cacheDir;
try {
    const { COMMON_CACHE_DIR } = require('#@/ncore/gvar/gdir.js');
    cacheDir = path.join(COMMON_CACHE_DIR, '.winget');
} catch (error) {
    const homeDir = os.homedir();   
    cacheDir = path.join(homeDir, 'core_node/.cache/.winget');
}

class WingetManager {
    constructor() {
        this.cacheDir = cacheDir;
        this.sourceConfigPath = path.join(this.cacheDir, 'winget_source.json');
        this.packagesCachePath = path.join(this.cacheDir, 'installed_packages.json');
        this.searchCachePath = path.join(this.cacheDir, 'search_results.json');
        this.packageCache = new Map();
        this.justInstalled = false;
    }

    ensureCache() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    isSourceConfigured() {
        try {
            if (fs.existsSync(this.sourceConfigPath)) {
                const config = JSON.parse(fs.readFileSync(this.sourceConfigPath, 'utf8'));
                return config.configured || false;
            }
            return false;
        } catch (error) {
            log.error('Error reading source config:', error);
            return false;
        }
    }

    async checkCurrentSource() {
        try {
            const output = await execCmdResultText('winget source list', true, null, log);
            return output.includes('https://mirrors.ustc.edu.cn/winget-source');
        } catch (error) {
            log.error('Error checking winget source:', error);
            return false;
        }
    }

    async configureSource() {
        if (!isWindows()) {
            log.info('Not a Windows system, skipping winget configuration');
            return false;
        }

        try {
            // Check if already configured
            if (this.isSourceConfigured() || await this.checkCurrentSource()) {
                log.info('Winget source already configured');
                this.saveSourceConfig();
                return true;
            }

            // Configure winget source
            await execCmdResultText('winget source remove winget', true, null, log);
            await execCmdResultText('winget source add winget https://mirrors.ustc.edu.cn/winget-source --trust-level trusted', true, null, log);

            this.saveSourceConfig();
            log.success('Winget source configured successfully');
            return true;
        } catch (error) {
            log.error('Error configuring winget source:', error);
            return false;
        }
    }

    saveSourceConfig() {
        this.ensureCache();
        fs.writeFileSync(this.sourceConfigPath, JSON.stringify({ configured: true }));
    }

    async isPackageInstalled(searchTerm) {
        if (!isWindows()) return false;

        try {
            // Search for the package
            const searchResults = await this.search(searchTerm, false);
            if (!searchResults.length) {
                log.info(`No packages found matching "${searchTerm}"`);
                return false;
            }

            // Get installed packages
            const installedPackages = await this.getInstalledPackages();

            // Check if any of the search results match installed packages
            return searchResults.some(searchResult => 
                installedPackages.some(installedPackage => {
                    const installedId = installedPackage.packageId.toLowerCase();
                    const searchId = searchResult.id.toLowerCase();
                    return installedId.includes(searchId) || searchId.includes(installedId);
                })
            );

        } catch (error) {
            log.error('Error checking if package is installed:', error);
            return false;
        }
    }

    async getInstalledPackages(useCache = true) {
        if (!isWindows()) return [];

        try {
            // If just installed something, force skip cache
            const shouldUseCache = useCache && !this.justInstalled;
            
            // Check cache first - use 5000ms (5 seconds) as maxAge
            const cacheResult = handleCache(this.packagesCachePath, 'installed', 5000, shouldUseCache);
            if (cacheResult.exists && cacheResult.isValid) {
                log.info('Using cached package list');
                this.justInstalled = false;
                return cacheResult.data;
            }

            // Get fresh data
            const output = await execCmdResultText('winget list', true, null, log);
            const packages = parseInstalledPackages(output);


            // Ensure cache directory exists and update cache
            if (useCache) {
                this.ensureCache();
                updateCache(this.packagesCachePath, 'installed', packages);
            }

            this.justInstalled = false;
            return packages;
        } catch (error) {
            log.error('Error getting installed packages:', error);
            this.justInstalled = false;
            return [];
        }
    }

    async search(searchTerm, useCache = true) {
        if (!isWindows()) return [];

        try {
            // Check cache first - use 1800000ms (30 minutes) as maxAge
            const cacheResult = handleCache(this.searchCachePath, searchTerm, 1800000, useCache);
            if (cacheResult.exists && cacheResult.isValid) {
                log.info(`Using cached search results for "${searchTerm}"`);
                return cacheResult.data;
            }

            // Get fresh data
            const output = await execCmdResultText(`winget search "${searchTerm}"`, true, null, log);
            const searchResults = parseSearchResults(output, searchTerm);
            
            // Ensure cache directory exists and update cache
            if (useCache) {
                this.ensureCache();
                updateCache(this.searchCachePath, searchTerm, searchResults);
            }

            log.info(`Found ${searchResults.length} packages matching "${searchTerm}"`);
            return searchResults;
        } catch (error) {
            log.error('Error searching packages:', error);
            return [];
        }
    }

    async searchWithPriority(searchTerms, useCache = true) {
        // If searchTerms is a string and contains commas, split it
        const mainTerm = Array.isArray(searchTerms) ? searchTerms[0] : searchTerms.split(',')[0];
        const searchResults = await this.search(mainTerm, useCache);
        if (!searchResults.length) return [];

        return sortSearchResults(searchResults, searchTerms);
    }

    async findBestMatchPackageId(searchTerms) {
        const sortedResults = await this.searchWithPriority(searchTerms);
        if (!sortedResults.length) {
            log.info(`No packages found for "${searchTerms}"`);
            return null;
        }

        const bestMatch = sortedResults[0];
        const keywords = normalizeKeywords(searchTerms);
        const matchScore = calculateMatchScore(bestMatch, keywords);

        log.info(`Best match for "${keywords.join(', ')}":`);
        log.info(`  Name: ${bestMatch.name}`);
        log.info(`  ID: ${bestMatch.id}`);
        log.info(`  Version: ${bestMatch.version}`);
        log.info(`  Source: ${bestMatch.source}`);
        log.info(`  Match Score: ${matchScore}`);
        
        if (sortedResults.length > 1) {
            log.info('\nOther matches:');
            sortedResults.slice(1).forEach(result => {
                const score = calculateMatchScore(result, keywords);
                log.info(`  - ${result.name} (${result.id}) [Score: ${score}]`);
            });
        }

        return bestMatch.id;
    }

    async installById(packageId, installDir = null) {
        if (!isWindows()) {
            log.error('Not a Windows system, cannot install packages');
            return false;
        }

        try {
            // Check if already installed
            const isInstalled = await this.isPackageInstalled(packageId);
            if (isInstalled) {
                log.info(`Package "${packageId}" is already installed`);
                return true;
            }

            // Verify if the package ID exists
            const searchResults = await this.search(packageId, false);
            const exactMatch = searchResults.find(pkg => pkg.id === packageId);
            if (!exactMatch) {
                log.error(`Invalid package ID: "${packageId}". Please provide a valid package ID`);
                return false;
            }

            // Prepare install command
            let installCmd = `winget install --accept-source-agreements --accept-package-agreements --id "${packageId}" --silent --force`;
            
            // Add location if specified
            if (installDir) {
                installCmd += ` --location "${installDir}"`;
            }

            // Install the package
            log.info(`Installing package "${packageId}"...`);
            await pipeExecCmd(installCmd, true, null, true);

            // Verify installation
            log.info('Verifying installation...');
            const verifyAttempts = 3;
            let isVerified = false;

            for (let i = 0; i < verifyAttempts; i++) {
                // Wait a bit before verification (especially for larger packages)
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

                const verifyInstalled = await this.isPackageInstalled(packageId);
                if (verifyInstalled) {
                    isVerified = true;
                    break;
                }
                log.warn(`Verification attempt ${i + 1}/${verifyAttempts} failed, retrying...`);
            }

            if (isVerified) {
                log.success(`Successfully installed and verified "${packageId}"`);
                this.justInstalled = true;
                return true;
            } else {
                log.error(`Installation verification failed for "${packageId}"`);
                return false;
            }

        } catch (error) {
            log.error(`Failed to install package "${packageId}":`, error);
            return false;
        }
    }

    async installByKeyword(keyword, installDir = null) {
        if (!isWindows()) {
            log.error('Not a Windows system, cannot install packages');
            return false;
        }

        try {
            // Find best match
            const bestMatchId = await this.findBestMatchPackageId(keyword);
            if (!bestMatchId) {
                log.error(`No package found matching "${keyword}"`);
                return false;
            }

            // Install using the found ID
            return await this.installById(bestMatchId, installDir);

        } catch (error) {
            log.error(`Failed to install package matching "${keyword}":`, error);
            return false;
        }
    }
}

const wingetManager = new WingetManager();
module.exports = wingetManager;

// Add test code that runs when file is executed directly
if (require.main === module) {
    async function runTests() {
        console.log('Running Winget Manager tests...');

        // Test 1: Check if running on Windows
        console.log('\nTest 1: Checking Windows platform');
        console.log('Is Windows:', isWindows());

        // Test 2: Configure source
        console.log('\nTest 2: Configuring winget source');
        await wingetManager.configureSource();

        // Test 3: Get installed packages
        console.log('\nTest 3: Getting installed packages');
        const packages = await wingetManager.getInstalledPackages();
        console.log('Installed packages:', packages);

        // Test 4: Search and check if installed
        const searchTerm = 'vscode';
        console.log(`\nTest 4: Search for "${searchTerm}"`);
        const searchResults = await wingetManager.search(searchTerm, false);
        console.log('Search results:', searchResults);

        console.log(`\nTest 5: Checking if ${searchTerm} is installed`);
        const isInstalled = await wingetManager.isPackageInstalled(searchTerm);
        console.log(`${searchTerm} is${isInstalled ? '' : ' not'} installed`);

        // Test 6: Search with priority

        // Test 8: Install by ID
        console.log('\nTest 8: Install by ID');
        const installResult1 = await wingetManager.installById('7zip.7zip',);
        console.log('Install result:', installResult1);

        // Test 9: Install by keyword
        // console.log('\nTest 9: Install by keyword');
        // const installResult2 = await wingetManager.installByKeyword('7zip');
        // console.log('Install result:', installResult2);
    }

    // Run the tests
    runTests().catch(error => {
        console.error('Test failed:', error);
        process.exit(1);
    });
} 