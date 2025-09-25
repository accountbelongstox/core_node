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

const fs = require('fs');
const path = require('path');
const logger = require('#@logger');

class ChromeVersionManager {
    constructor() {
        this.versionMap = {
            '23.4.1': '129.0.6668.70',
            '23.4.0': '129.0.6668.58',
            '23.3.1': '128.0.6613.137',
            '23.3.0': '128.0.6613.119',
            '23.2.2': '128.0.6613.119',
            '23.2.1': '128.0.6613.86',
            '23.2.0': '128.0.6613.86',
            '23.1.0': '127.0.6533.146',
            '23.0.0': '127.0.6533.146',
            '22.0.0': '126.0.6478.114',
            '21.0.0': '125.0.6422.78',
            '20.0.0': '124.0.6367.78'
        };
    }

    /**
     * Get Puppeteer version from package.json
     * @returns {string} Puppeteer version
     */
    getPuppeteerVersion() {
        try {
            const packageJsonPath = path.join(process.cwd(), 'package.json');
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            
            // Check both dependencies and devDependencies
            const puppeteerVersion = packageJson.dependencies?.puppeteer || 
                                   packageJson.devDependencies?.puppeteer ||
                                   packageJson.dependencies?.['puppeteer-extra'] ||
                                   packageJson.devDependencies?.['puppeteer-extra'];

            if (puppeteerVersion) {
                return puppeteerVersion.replace('^', '').replace('~', '');
            } else {
                logger.warn('Puppeteer version not found in package.json. Using default version 23.4.1');
                return '23.4.1';
            }
        } catch (error) {
            logger.warn('Error reading package.json. Using default Puppeteer version 23.4.1');
            return '23.4.1';
        }
    }

    /**
     * Get Chrome version based on Puppeteer version
     * @param {string} puppeteerVersion - Puppeteer version
     * @returns {string} Chrome version
     */
    getChromeVersion(puppeteerVersion) {
        const majorMinorVersion = puppeteerVersion.split('.').slice(0, 2).join('.');

        for (const [puppeteerVer, chromeVer] of Object.entries(this.versionMap)) {
            if (puppeteerVer.startsWith(majorMinorVersion)) {
                return chromeVer;
            }
        }

        logger.warn('No matching Chrome version found, using latest');
        return 'latest';
    }

    /**
     * Get compatible Chrome version for current Puppeteer
     * @returns {string} Chrome version
     */
    getCompatibleChromeVersion() {
        const puppeteerVersion = this.getPuppeteerVersion();
        return this.getChromeVersion(puppeteerVersion);
    }

    /**
     * Check if installed Chrome version is compatible
     * @param {string} installedChromeVersion - Installed Chrome version
     * @returns {boolean} True if compatible
     */
    isChromeVersionCompatible(installedChromeVersion) {
        const requiredVersion = this.getCompatibleChromeVersion();
        
        if (requiredVersion === 'latest') {
            return true; // Always compatible with latest
        }

        try {
            const installed = this.parseVersion(installedChromeVersion);
            const required = this.parseVersion(requiredVersion);
            
            return this.compareVersions(installed, required) >= 0;
        } catch (error) {
            logger.warn('Error comparing Chrome versions:', error.message);
            return false;
        }
    }

    /**
     * Parse version string to array
     * @param {string} version - Version string
     * @returns {Array} Version array
     */
    parseVersion(version) {
        return version.split('.').map(Number);
    }

    /**
     * Compare two version arrays
     * @param {Array} version1 - First version
     * @param {Array} version2 - Second version
     * @returns {number} Comparison result
     */
    compareVersions(version1, version2) {
        const maxLength = Math.max(version1.length, version2.length);
        
        for (let i = 0; i < maxLength; i++) {
            const v1 = version1[i] || 0;
            const v2 = version2[i] || 0;
            
            if (v1 > v2) return 1;
            if (v1 < v2) return -1;
        }
        
        return 0;
    }
}

module.exports = new ChromeVersionManager(); 