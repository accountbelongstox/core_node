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
const { install } = require('@puppeteer/browsers');
const logger = require('#@logger');
const gconfig = require('#@gconfig');
const { getCompatibleChromeVersion } = require('../chrome_version.js');

const defaultChromeDir = path.join(gconfig.APP_INSTALL_DIR, 'Google');
const baseDirsWindows = [
    'C:\\Program Files\\Google\\Chrome\\Application',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application',
    defaultChromeDir,
    path.join(gconfig.APP_INSTALL_DIR, 'Chrome'),
    gconfig.APP_INSTALL_DIR
];

const baseDirsLinux = [
    '/usr/bin',
    '/usr/local/bin',
    '/opt/google/chrome',
    '/snap/bin',
    defaultChromeDir,
    path.join(gconfig.APP_INSTALL_DIR, 'chrome'),
    gconfig.APP_INSTALL_DIR
];

const baseDirectories = process.platform === 'win32' ? baseDirsWindows : baseDirsLinux;

function findChromeExecutable(dirs) {
    const globalChromePath = checkGlobalChromePath();
    if (globalChromePath) {
        return globalChromePath;
    }

    const executableName = process.platform === 'win32' ? 'chrome.exe' : 'chrome';
    
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            continue;
        }
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            if (fs.statSync(filePath).isDirectory()) {
                const subDirResult = findChromeExecutable([filePath]); // 递归查找
                if (subDirResult) {
                    return subDirResult;
                }
            } else if (file === executableName) {
                return filePath; // 确保返回的是完整的可执行文件路径
            }
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

    const macPaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ];

    let pathsToCheck = isWindows ? baseDirsWindows : process.platform === 'darwin' ? macPaths : linuxPaths;

    for (const chromePath of pathsToCheck) {
        const chromeExec = isWindows ? path.join(chromePath, 'chrome.exe') : chromePath;
        if (fs.existsSync(chromeExec)) {
            return chromeExec;
        }
    }
    return null;
}

async function ensureChrome() {
    let existingChromePath = findChromeExecutable(baseDirectories);

    if (existingChromePath) {
        logger.info(`Chrome already exists at: ${existingChromePath}`);
        return existingChromePath;
    }
    logger.warn('Chrome not found. Attempting to install...');

    try {
        const versionInfo = getCompatibleChromeVersion();
        logger.info(`Installing Chrome version ${versionInfo.chromeVersion} for Puppeteer ${versionInfo.puppeteerVersion}`);

        await install({
            browser: 'chrome',
            buildId: versionInfo.buildId,
            cacheDir: defaultChromeDir,
        });

        logger.info('Chrome installation completed.');
        existingChromePath = findChromeExecutable([defaultChromeDir]);
        if (existingChromePath) {
            logger.info(`Installed Chrome found at: ${existingChromePath}`);
            return existingChromePath;
        } else {
            logger.error('Chrome was installed, but executable not found.');
            // Try to find in the cache directory structure
            const chromeInstallPath = path.join(defaultChromeDir, 'chrome');
            if (fs.existsSync(chromeInstallPath)) {
                const chromeSubPath = findChromeExecutable([chromeInstallPath]);
                if (chromeSubPath) {
                    logger.info(`Found Chrome in cache directory: ${chromeSubPath}`);
                    return chromeSubPath;
                }
            }
            return null;
        }
    } catch (error) {
        logger.error(`Failed to install Chrome: ${error.message}`);
        logger.info('Attempting fallback installation with latest version...');

        try {
            await install({
                browser: 'chrome',
                buildId: 'latest',
                cacheDir: defaultChromeDir,
            });

            existingChromePath = findChromeExecutable([defaultChromeDir]);
            if (existingChromePath) {
                logger.info(`Fallback Chrome installation successful: ${existingChromePath}`);
                return existingChromePath;
            }
        } catch (fallbackError) {
            logger.error(`Fallback Chrome installation also failed: ${fallbackError.message}`);
        }

        return null;
    }
}

async function findChromePath() {
    let chromePath = findChromeExecutable(baseDirectories);

    if (chromePath) {
        logger.info(`Chrome found at: ${chromePath}`);
        return chromePath;
    }

    logger.warn('Chrome not found, attempting to install...');
    chromePath = await ensureChrome();

    if (!chromePath) {
        chromePath = findChromeExecutable(baseDirectories);
    }

    if (chromePath) {
        logger.info(`After installation, Chrome found at: ${chromePath}`);
    } else {
        logger.error('Chrome could not be found after installation.');
    }

    return chromePath;
}

module.exports = {
    ensureChrome,
    findChromePath,
    findChromeExecutable,
    checkGlobalChromePath,
};
