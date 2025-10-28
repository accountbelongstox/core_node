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

class ChromeVersionMapper {
    constructor() {
        this.versionMap = this.getChromeVersionMap();
    }

    // Get Chrome version mapping based on Puppeteer version
    getChromeVersionMap() {
        return {
            '23.4.1': '131.0.6778.85',
            '23.4.0': '131.0.6778.69',
            '23.3.1': '130.0.6723.116',
            '23.3.0': '130.0.6723.91',
            '23.2.2': '130.0.6723.91',
            '23.2.1': '130.0.6723.58',
            '23.1.1': '129.0.6668.89',
            '23.1.0': '129.0.6668.69',
            '23.0.2': '128.0.6613.105',
            '23.0.1': '128.0.6613.84',
            '23.0.0': '128.0.6613.63',
            '22.15.0': '127.0.6533.120',
            '22.14.0': '127.0.6533.88',
            '22.13.1': '126.0.6478.127',
            '22.13.0': '126.0.6478.88',
            '22.12.0': '126.0.6478.61',
            '22.11.0': '125.0.6422.141',
            '22.10.0': '125.0.6422.78',
            '22.9.0': '124.0.6367.155',
            '22.8.0': '124.0.6367.78',
            '22.7.1': '123.0.6312.122',
            '22.7.0': '123.0.6312.86',
            '22.6.0': '123.0.6312.58',
            '22.5.0': '122.0.6261.128',
            '22.4.0': '122.0.6261.69',
            '22.3.0': '122.0.6261.39',
            '22.2.0': '121.0.6167.184',
            '22.1.0': '121.0.6167.139',
            '22.0.0': '121.0.6167.85',
            '21.11.0': '120.0.6099.216',
            '21.10.0': '120.0.6099.109',
            '21.9.0': '120.0.6099.71',
            '21.8.0': '119.0.6045.199',
            '21.7.0': '119.0.6045.105',
            '21.6.0': '119.0.6045.66',
            '21.5.0': '118.0.5993.117',
            '21.4.0': '118.0.5993.88',
            '21.3.0': '118.0.5993.70',
            '21.2.0': '117.0.5938.149',
            '21.1.0': '117.0.5938.92',
            '21.0.0': '117.0.5938.62',
            '20.9.0': '116.0.5845.187',
            '20.8.0': '116.0.5845.96',
            '20.7.0': '116.0.5845.82',
            '20.6.0': '115.0.5790.171',
            '20.5.0': '115.0.5790.102',
            '20.4.0': '115.0.5790.70',
            '20.3.0': '114.0.5735.133',
            '20.2.0': '114.0.5735.90',
            '20.1.0': '114.0.5735.45',
            '20.0.0': '113.0.5672.126',
            '19.11.0': '113.0.5672.92',
            '19.10.0': '113.0.5672.63',
            '19.9.0': '112.0.5615.137',
            '19.8.0': '112.0.5615.49',
            '19.7.0': '112.0.5615.29',
            '19.6.0': '111.0.5563.146',
            '19.5.0': '111.0.5563.64',
            '19.4.0': '110.0.5481.177',
            '19.3.0': '110.0.5481.100',
            '19.2.0': '110.0.5481.77',
            '19.1.0': '109.0.5414.120',
            '19.0.0': '109.0.5414.74',
            '18.3.0': '109.0.5414.25',
            '18.2.0': '108.0.5359.124',
            '18.1.0': '108.0.5359.94',
            '18.0.0': '108.0.5359.71',
            '17.1.0': '107.0.5304.110',
            '17.0.0': '107.0.5304.68',
            '16.2.0': '106.0.5249.119',
            '16.1.0': '106.0.5249.91',
            '16.0.0': '106.0.5249.61',
            '15.5.0': '105.0.5195.52',
            '15.4.0': '104.0.5112.79',
            '15.3.0': '104.0.5112.20',
            '15.2.0': '103.0.5060.134',
            '15.1.0': '103.0.5060.53',
            '15.0.0': '102.0.5005.61',
            '14.4.0': '101.0.4951.64',
            '14.3.0': '101.0.4951.41',
            '14.2.0': '100.0.4896.127',
            '14.1.0': '100.0.4896.75',
            '14.0.0': '100.0.4896.60',
            '13.7.0': '99.0.4844.84',
            '13.6.0': '98.0.4758.102',
            '13.5.0': '98.0.4758.80',
            '13.4.0': '98.0.4758.48',
            '13.3.0': '97.0.4692.99',
            '13.2.0': '97.0.4692.71',
            '13.1.0': '96.0.4664.110',
            '13.0.0': '96.0.4664.93',
            '12.0.0': '96.0.4664.45',
            '11.0.0': '95.0.4638.69',
            '10.4.0': '95.0.4638.54',
            '10.3.0': '95.0.4638.32',
            '10.2.0': '94.0.4606.113',
            '10.1.0': '94.0.4606.81',
            '10.0.0': '93.0.4577.63',
            '9.1.0': '92.0.4515.107',
            '9.0.0': '91.0.4472.164',
            '8.0.0': '91.0.4472.124',
            '7.1.0': '91.0.4472.106',
            '7.0.0': '91.0.4472.77',
            '6.0.0': '91.0.4472.19',
            '5.5.0': '90.0.4430.212',
            '5.4.0': '90.0.4430.72',
            '5.3.0': '89.0.4389.114',
            '5.2.0': '88.0.4324.182',
            '5.1.0': '88.0.4324.150',
            '5.0.0': '87.0.4280.88',
            '4.0.0': '86.0.4240.198',
            '3.3.0': '86.0.4240.111',
            '3.2.0': '86.0.4240.75',
            '3.1.0': '85.0.4183.121',
            '3.0.0': '85.0.4183.102',
            '2.1.0': '85.0.4183.83',
            '2.0.0': '84.0.4147.125',
            '1.20.0': '83.0.4103.116',
            '1.19.0': '83.0.4103.105',
            '1.18.0': '83.0.4103.97',
            '1.17.0': '83.0.4103.61',
            '1.16.0': '82.0.4085.61',
            '1.15.0': '81.0.4044.138',
            '1.14.0': '81.0.4044.138',
            '1.13.0': '80.0.3987.163',
            '1.12.0': '80.0.3987.149',
            '1.11.0': '80.0.3987.132',
            '1.10.0': '79.0.3945.130',
            '1.9.0': '79.0.3945.88',
            '1.8.0': '79.0.3945.79',
            '1.7.0': '78.0.3882.7',
            '1.6.0': '77.0.3809.132',
            '1.5.0': '77.0.3809.88',
            '1.4.0': '77.0.3809.68',
            '1.3.0': '76.0.3809.88',
            '1.2.0': '76.0.3809.68',
            '1.1.0': '75.0.3770.100',
            '1.0.0': '75.0.3770.80'
        };
    }

    // Get Chrome version for given Puppeteer version
    getChromeVersion(puppeteerVersion) {
        const version = this.versionMap[puppeteerVersion];
        if (version) {
            logger.debug(`Mapped Puppeteer ${puppeteerVersion} to Chrome ${version}`);
            return version;
        }
        
        // If exact version not found, try to find closest match
        const closestVersion = this.findClosestVersion(puppeteerVersion);
        if (closestVersion) {
            logger.warn(`Exact Puppeteer version ${puppeteerVersion} not found, using closest match ${closestVersion}`);
            return this.versionMap[closestVersion];
        }
        
        // Fallback to latest version
        logger.warn(`No Chrome version mapping found for Puppeteer ${puppeteerVersion}, using latest`);
        return this.versionMap['23.4.1'];
    }

    // Find closest Puppeteer version
    findClosestVersion(puppeteerVersion) {
        const versions = Object.keys(this.versionMap).sort((a, b) => {
            const aParts = a.split('.').map(Number);
            const bParts = b.split('.').map(Number);
            
            for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                const aPart = aParts[i] || 0;
                const bPart = bParts[i] || 0;
                
                if (aPart !== bPart) {
                    return bPart - aPart; // Descending order
                }
            }
            
            return 0;
        });
        
        const targetParts = puppeteerVersion.split('.').map(Number);
        
        for (const version of versions) {
            const versionParts = version.split('.').map(Number);
            
            // Check if major and minor versions match
            if (versionParts[0] === targetParts[0] && versionParts[1] === targetParts[1]) {
                return version;
            }
        }
        
        return null;
    }

    // Get all available Puppeteer versions
    getAvailablePuppeteerVersions() {
        return Object.keys(this.versionMap).sort((a, b) => {
            const aParts = a.split('.').map(Number);
            const bParts = b.split('.').map(Number);
            
            for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                const aPart = aParts[i] || 0;
                const bPart = bParts[i] || 0;
                
                if (aPart !== bPart) {
                    return bPart - aPart; // Descending order
                }
            }
            
            return 0;
        });
    }

    // Get all available Chrome versions
    getAvailableChromeVersions() {
        return Object.values(this.versionMap).sort((a, b) => {
            const aParts = a.split('.').map(Number);
            const bParts = b.split('.').map(Number);
            
            for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                const aPart = aParts[i] || 0;
                const bPart = bParts[i] || 0;
                
                if (aPart !== bPart) {
                    return bPart - aPart; // Descending order
                }
            }
            
            return 0;
        });
    }

    // Get version mapping info
    getVersionMappingInfo() {
        return {
            totalMappings: Object.keys(this.versionMap).length,
            latestPuppeteerVersion: '23.4.1',
            latestChromeVersion: this.versionMap['23.4.1'],
            availablePuppeteerVersions: this.getAvailablePuppeteerVersions(),
            availableChromeVersions: this.getAvailableChromeVersions()
        };
    }

    // Check if Puppeteer version is supported
    isPuppeteerVersionSupported(puppeteerVersion) {
        return this.versionMap.hasOwnProperty(puppeteerVersion);
    }

    // Get supported version range
    getSupportedVersionRange() {
        const versions = this.getAvailablePuppeteerVersions();
        return {
            min: versions[versions.length - 1],
            max: versions[0],
            count: versions.length
        };
    }

    // Get Chrome version for system installation
    getChromeVersionForSystemInstall(puppeteerVersion) {
        const chromeVersion = this.getChromeVersion(puppeteerVersion);
        
        // Extract major version for system installation
        const majorVersion = chromeVersion.split('.')[0];
        
        return {
            fullVersion: chromeVersion,
            majorVersion: majorVersion,
            installationKey: `chrome-${majorVersion}`,
            downloadUrl: this.getChromeDownloadUrl(chromeVersion)
        };
    }

    // Get Chrome download URL for specific version
    getChromeDownloadUrl(chromeVersion) {
        const majorVersion = chromeVersion.split('.')[0];
        
        // Chrome download URLs (these may change over time)
        return {
            linux: `https://dl.google.com/linux/chrome/deb/pool/main/g/google-chrome-stable/google-chrome-stable_${chromeVersion}-1_amd64.deb`,
            windows: `https://dl.google.com/release2/chrome/${chromeVersion}_win64.exe`,
            mac: `https://dl.google.com/chrome/mac/stable/GGRO/googlechrome.dmg`
        };
    }

    // Validate Chrome version format
    validateChromeVersion(version) {
        const versionRegex = /^\d+\.\d+\.\d+\.\d+$/;
        return versionRegex.test(version);
    }

    // Compare Chrome versions
    compareChromeVersions(version1, version2) {
        const v1Parts = version1.split('.').map(Number);
        const v2Parts = version2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
            const v1Part = v1Parts[i] || 0;
            const v2Part = v2Parts[i] || 0;
            
            if (v1Part !== v2Part) {
                return v1Part - v2Part;
            }
        }
        
        return 0;
    }

    // Check if Chrome version is compatible with Puppeteer version
    isChromeVersionCompatible(chromeVersion, puppeteerVersion) {
        const expectedChromeVersion = this.getChromeVersion(puppeteerVersion);
        return this.compareChromeVersions(chromeVersion, expectedChromeVersion) === 0;
    }
}

module.exports = ChromeVersionMapper;
