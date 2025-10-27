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

const fs = require('fs');
const path = require('path');
const logger = require('#@logger');

function getPuppeteerVersion() {
    try {
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const puppeteerVersion = packageJson.dependencies.puppeteer || packageJson.devDependencies.puppeteer;

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

function getChromeVersion(puppeteerVersion) {
    const versionMap = {
        '23.4.1': '129.0.6668.70',
        '23.4.0': '129.0.6668.58',
        '23.3.1': '128.0.6613.137',
        '23.3.0': '128.0.6613.119',
        '23.2.2': '128.0.6613.119',
        '23.2.1': '128.0.6613.86',
        '23.1.1': '127.0.6533.119',
        '23.1.0': '127.0.6533.88',
        '23.0.2': '126.0.6478.182',
        '23.0.1': '126.0.6478.126',
        '23.0.0': '126.0.6478.61',
        '22.15.0': '125.0.6422.141',
        '22.14.0': '125.0.6422.78',
        '22.13.1': '124.0.6367.207',
        '22.13.0': '124.0.6367.155',
        '22.12.1': '124.0.6367.91',
        '22.12.0': '124.0.6367.78',
        '22.11.2': '123.0.6312.122',
        '22.11.1': '123.0.6312.105',
        '22.11.0': '123.0.6312.86',
        '22.10.1': '122.0.6261.128',
        '22.10.0': '122.0.6261.94',
        '22.9.0': '121.0.6167.184',
        '22.8.2': '121.0.6167.139',
        '22.8.1': '121.0.6167.85',
        '22.8.0': '121.0.6167.57'
    };

    const majorMinorVersion = puppeteerVersion.split('.').slice(0, 2).join('.');

    for (const [puppeteerVer, chromeVer] of Object.entries(versionMap)) {
        if (puppeteerVer.startsWith(majorMinorVersion)) {
            return chromeVer;
        }
    }

    logger.warn(`No matching Chrome version found for Puppeteer ${puppeteerVersion}, using latest`);
    return 'latest';
}

function getCompatibleChromeVersion() {
    const puppeteerVersion = getPuppeteerVersion();
    const chromeVersion = getChromeVersion(puppeteerVersion);

    logger.info(`Puppeteer version: ${puppeteerVersion}, Compatible Chrome version: ${chromeVersion}`);

    return {
        puppeteerVersion,
        chromeVersion,
        buildId: chromeVersion === 'latest' ? 'latest' : chromeVersion
    };
}

module.exports = {
    getPuppeteerVersion,
    getChromeVersion,
    getCompatibleChromeVersion
};



