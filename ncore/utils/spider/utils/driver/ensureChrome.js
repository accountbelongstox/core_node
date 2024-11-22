import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { install } from '@puppeteer/browsers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDir = path.join(__dirname, '..');

function getBaseDir(file) {
    if (file) file = path.join(baseDir, file);
    return file;
}

function getLibrary(file) {
    let libraryDir = getBaseDir(`library`);
    if (file && !path.isAbsolute(file)) file = path.join(libraryDir, file);
    return file ? file : libraryDir;
}

async function ensureChrome() {
    let existingChromePath = findChromeExecutable();
    
    if (existingChromePath) {
        console.log('Chrome already exists at:', existingChromePath);
        return existingChromePath;
    }
    console.log('Chrome not found. Installing...');
    try {
        const puppeteerVersion = getPuppeteerVersion();
        console.log('Current Puppeteer version:', puppeteerVersion);

        const chromeVersion = getChromeVersion(puppeteerVersion);
        console.log('Corresponding Chrome version:', chromeVersion);

        await install({
            browser: 'chrome',
            buildId: chromeVersion,
            cacheDir: getLibrary(),
        });
        console.log('Chrome installed successfully');
        existingChromePath = findChromeExecutable();
        if (existingChromePath) {
            console.log('Installed Chrome found at:', existingChromePath);
            return existingChromePath;
        } else {
            console.error('Chrome installed but executable not found');
            return null;
        }
    } catch (error) {
        console.error('Failed to install Chrome:', error);
        return null;
    }
}

function findChromeExecutable(dir) {
    const globalChromePath = checkGlobalChromePath();
    if (globalChromePath) {
        return globalChromePath;
    }
    dir = dir ? getLibrary(dir) : getLibrary();
    const executableName = process.platform === 'win32' ? 'chrome.exe' : 'chrome';
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            const subDirResult = findChromeExecutable(filePath);
            if (subDirResult) {
                return subDirResult;
            }
        } else if (file === executableName) {
            return path.join(dir, executableName);
        }
    }
    return null;
}

function checkGlobalChromePath() {
    if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
        return process.env.CHROME_BIN;
    }
    const isWindows = process.platform === 'win32';
    const linuxPaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
    ];

    const windowsPaths = [
    ];

    const macPaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ];

    let pathsToCheck = [];

    if (isWindows) {
        pathsToCheck = windowsPaths;
    } else if (process.platform === 'darwin') {
        pathsToCheck = macPaths;
    } else {
        pathsToCheck = linuxPaths;
    }

    for (const path of pathsToCheck) {
        if (fs.existsSync(path)) {
            return path;
        }
    }

    return null;
}

function getPuppeteerVersion() {
    try {
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const puppeteerVersion = packageJson.dependencies.puppeteer || packageJson.devDependencies.puppeteer;
        
        if (puppeteerVersion) {
            return puppeteerVersion.replace('^', '').replace('~', '');
        } else {
            console.warn('Puppeteer version not found in package.json. Using default version 23.4.1');
            return '23.4.1';
        }
    } catch (error) {
        console.warn('Error reading package.json. Using default Puppeteer version 23.4.1');
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
        '23.2.0': '128.0.6613.84',
        '23.1.1': '127.0.6533.119',
        '23.1.0': '127.0.6533.119',
        '23.0.2': '127.0.6533.99',
        '23.0.0': '127.0.6533.88',
        '22.15.0': '127.0.6533.88',
        '22.14.0': '127.0.6533.72',
        '22.13.1': '126.0.6478.182',
        '22.12.1': '126.0.6478.126',
        '22.12.0': '126.0.6478.63',
        '22.11.1': '126.0.6478.61',
        '22.11.0': '126.0.6478.55',
        '22.10.1': '125.0.6422.141',
        '22.10.0': '125.0.6422.78',
        '22.9.0': '125.0.6422.60',
        '22.8.2': '124.0.6367.207',
        '22.8.1': '124.0.6367.201',
        '22.8.0': '124.0.6367.91',
        '22.7.1': '124.0.6367.78',
        '22.7.0': '124.0.6367.60',
        '22.6.4': '123.0.6312.122',
        '22.6.3': '123.0.6312.105',
        '22.6.2': '123.0.6312.86',
        '22.6.0': '123.0.6312.58',
        '22.5.0': '122.0.6261.128',
        '22.4.1': '122.0.6261.111',
        '22.4.0': '122.0.6261.94',
        '22.3.0': '122.0.6261.69',
        '22.2.0': '122.0.6261.57',
        '21.9.0': '121.0.6167.85',
        '21.8.0': '120.0.6099.109',
        '21.5.0': '119.0.6045.105',
        '21.4.0': '118.0.5993.70',
        '21.3.7': '117.0.5938.149',
        '21.3.2': '117.0.5938.92',
        '21.3.0': '117.0.5938.62',
        '21.1.0': '116.0.5845.96',
        '21.0.2': '115.0.5790.170',
        '21.0.0': '115.0.5790.102',
        '20.9.0': '115.0.5790.98',
        '20.7.2': '114.0.5735.133',
        '20.6.0': '114.0.5735.90',
        '20.1.0': '113.0.5672.63',
        '20.0.0': '112.0.5615.121',
        '19.8.0': '112.0.5614.0',
        '19.7.0': '111.0.5556.0',
        '19.6.0': '110.0.5479.0',
        '19.4.0': '109.0.5412.0',
        '19.2.0': '108.0.5351.0',
        '18.1.0': '107.0.5296.0',
        '17.1.0': '106.0.5249.0',
        '15.5.0': '105.0.5173.0',
        '15.1.0': '104.0.5109.0',
        '14.2.0': '103.0.5059.0',
        '14.0.0': '102.0.5002.0',
        '13.6.0': '101.0.4950.0',
        '13.5.0': '100.0.4889.0',
        '13.2.0': '99.0.4844.16',
        '13.1.0': '98.0.4758.0',
        '12.0.0': '97.0.4692.0',
        '10.2.0': '93.0.4577.0',
        '10.0.0': '92.0.4512.0',
        '9.0.0': '91.0.4469.0',
        '8.0.0': '90.0.4427.0',
        '7.0.0': '90.0.4403.0',
        '6.0.0': '89.0.4389.0',
        '5.5.0': '88.0.4298.0',
        '5.4.0': '87.0.4272.0',
        '5.3.0': '86.0.4240.0',
        '5.2.1': '85.0.4182.0',
        '5.1.0': '84.0.4147.0',
        '3.1.0': '83.0.4103.0',
        '3.0.0': '81.0.4044.0',
        '2.1.0': '80.0.3987.0',
        '2.0.0': '79.0.3942.0',
        '1.20.0': '78.0.3882.0',
        '1.19.0': '77.0.3803.0',
        '1.17.0': '76.0.3803.0',
        '1.15.0': '75.0.3765.0',
        '1.13.0': '74.0.3723.0',
        '1.12.2': '73.0.3679.0'
    };

    const majorMinorVersion = puppeteerVersion.split('.').slice(0, 2).join('.');

    for (const [puppeteerVer, chromeVer] of Object.entries(versionMap)) {
        if (puppeteerVer.startsWith(majorMinorVersion)) {
            return chromeVer;
        }
    }

    console.warn('No matching Chrome version found, using latest');
    return 'latest';
}

// Export all functions
export {
    ensureChrome,
    findChromeExecutable,
    checkGlobalChromePath,
    getPuppeteerVersion,
    getChromeVersion
};

// Also provide a default export
export default {
    ensureChrome,
    findChromeExecutable,
    checkGlobalChromePath,
    getPuppeteerVersion,
    getChromeVersion
};