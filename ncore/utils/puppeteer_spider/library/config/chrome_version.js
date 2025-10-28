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

function getEdgeVersion(puppeteerVersion) {
    const edgeVersionMap = {
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
        '22.13.0': '124.0.6367.78',
        '22.12.0': '124.0.6367.60',
        '22.11.0': '123.0.6312.122',
        '22.10.0': '123.0.6312.86',
        '22.9.0': '122.0.6261.128',
        '22.8.0': '122.0.6261.69',
        '22.7.1': '121.0.6167.184',
        '22.7.0': '121.0.6167.139',
        '22.6.0': '121.0.6167.85',
        '22.5.0': '120.0.6099.216',
        '22.4.0': '120.0.6099.109',
        '22.3.0': '120.0.6099.71',
        '22.2.0': '119.0.6045.199',
        '22.1.0': '119.0.6045.105',
        '22.0.0': '119.0.6045.66',
        '21.11.0': '118.0.5993.117',
        '21.10.0': '118.0.5993.88',
        '21.9.0': '118.0.5993.70',
        '21.8.0': '117.0.5938.149',
        '21.7.0': '117.0.5938.92',
        '21.6.0': '117.0.5938.62',
        '21.5.0': '116.0.5845.187',
        '21.4.0': '116.0.5845.96',
        '21.3.0': '116.0.5845.82',
        '21.2.0': '115.0.5790.171',
        '21.1.0': '115.0.5790.102',
        '21.0.0': '115.0.5790.70',
        '20.9.0': '114.0.5735.133',
        '20.8.0': '114.0.5735.90',
        '20.7.0': '114.0.5735.45',
        '20.6.0': '113.0.5672.126',
        '20.5.0': '113.0.5672.92',
        '20.4.0': '113.0.5672.63',
        '20.3.0': '112.0.5615.137',
        '20.2.0': '112.0.5615.49',
        '20.1.0': '112.0.5615.29',
        '20.0.0': '111.0.5563.146',
        '19.11.0': '111.0.5563.64',
        '19.10.0': '110.0.5481.177',
        '19.9.0': '110.0.5481.100',
        '19.8.0': '110.0.5481.77',
        '19.7.0': '109.0.5414.120',
        '19.6.0': '109.0.5414.74',
        '19.5.0': '109.0.5414.25',
        '19.4.0': '108.0.5359.124',
        '19.3.0': '108.0.5359.94',
        '19.2.0': '108.0.5359.71',
        '19.1.0': '107.0.5304.110',
        '19.0.0': '107.0.5304.68',
        '18.3.0': '106.0.5249.119',
        '18.2.0': '106.0.5249.91',
        '18.1.0': '106.0.5249.61',
        '18.0.0': '105.0.5195.52',
        '17.1.0': '104.0.5112.79',
        '17.0.0': '104.0.5112.20',
        '16.2.0': '103.0.5060.134',
        '16.1.0': '103.0.5060.53',
        '16.0.0': '102.0.5005.61',
        '15.5.0': '101.0.4951.64',
        '15.4.0': '101.0.4951.41',
        '15.3.0': '100.0.4896.127',
        '15.2.0': '100.0.4896.75',
        '15.1.0': '100.0.4896.60',
        '15.0.0': '99.0.4844.84',
        '14.4.0': '98.0.4758.102',
        '14.3.0': '98.0.4758.80',
        '14.2.0': '98.0.4758.48',
        '14.1.0': '97.0.4692.99',
        '14.0.0': '97.0.4692.71',
        '13.7.0': '96.0.4664.110',
        '13.6.0': '96.0.4664.93',
        '13.5.0': '96.0.4664.45',
        '13.4.0': '95.0.4638.69',
        '13.3.0': '95.0.4638.54',
        '13.2.0': '95.0.4638.32',
        '13.1.0': '94.0.4606.113',
        '13.0.0': '94.0.4606.81',
        '12.0.0': '93.0.4577.63',
        '11.0.0': '92.0.4515.107',
        '10.4.0': '91.0.4472.164',
        '10.3.0': '91.0.4472.124',
        '10.2.0': '91.0.4472.106',
        '10.1.0': '91.0.4472.77',
        '10.0.0': '91.0.4472.19',
        '9.1.0': '90.0.4430.212',
        '9.0.0': '90.0.4430.72',
        '8.0.0': '89.0.4389.114',
        '7.1.0': '88.0.4324.182',
        '7.0.0': '88.0.4324.150',
        '6.0.0': '87.0.4280.88',
        '5.5.0': '86.0.4240.198',
        '5.4.0': '86.0.4240.111',
        '5.3.0': '86.0.4240.75',
        '5.2.0': '85.0.4183.121',
        '5.1.0': '85.0.4183.102',
        '5.0.0': '85.0.4183.83',
        '4.0.0': '84.0.4147.125',
        '3.3.0': '83.0.4103.116',
        '3.2.0': '83.0.4103.105',
        '3.1.0': '83.0.4103.97',
        '3.0.0': '83.0.4103.61',
        '2.1.0': '82.0.4085.61',
        '2.0.0': '81.0.4044.138',
        '1.20.0': '81.0.4044.138',
        '1.19.0': '80.0.3987.163',
        '1.18.0': '80.0.3987.149',
        '1.17.0': '80.0.3987.132',
        '1.16.0': '79.0.3945.130',
        '1.15.0': '79.0.3945.88',
        '1.14.0': '79.0.3945.79',
        '1.13.0': '78.0.3882.7',
        '1.12.0': '77.0.3809.132',
        '1.11.0': '77.0.3809.88',
        '1.10.0': '77.0.3809.68',
        '1.9.0': '76.0.3809.88',
        '1.8.0': '76.0.3809.68',
        '1.7.0': '75.0.3770.100',
        '1.6.0': '75.0.3770.80',
        '1.5.0': '75.0.3770.80',
        '1.4.0': '74.0.3729.169',
        '1.3.0': '74.0.3729.131',
        '1.2.0': '74.0.3729.108',
        '1.1.0': '73.0.3683.103',
        '1.0.0': '73.0.3683.68'
    };

    return edgeVersionMap[puppeteerVersion] || edgeVersionMap['23.4.1'];
}

function getBrowserVersion(browserType, puppeteerVersion) {
    if (browserType === 'edge') {
        return getEdgeVersion(puppeteerVersion);
    } else {
        return getChromeVersion(puppeteerVersion);
    }
}

module.exports = {
    getPuppeteerVersion,
    getChromeVersion,
    getCompatibleChromeVersion,
    getEdgeVersion,
    getBrowserVersion
};



