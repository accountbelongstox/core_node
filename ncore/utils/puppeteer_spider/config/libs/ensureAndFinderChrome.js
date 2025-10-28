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
const { fixChromeSymlinkIssues } = require('../../../system/fix_symlink_loops.js');

// Safe fallback for APP_INSTALL_DIR to avoid circular dependency and permission issues
const safeAppInstallDir = gconfig.APP_INSTALL_DIR || (process.platform === 'win32' ? 'D:\\applications' : '/home/ubuntu/.core_node/applications');
const defaultChromeDir = path.join(safeAppInstallDir, 'Google');
const baseDirsWindows = [
    'C:\\Program Files\\Google\\Chrome\\Application',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application',
    defaultChromeDir,
    path.join(safeAppInstallDir, 'Chrome'),
    safeAppInstallDir
];

const baseDirsLinux = [
    '/usr/bin',
    '/usr/local/bin',
    '/opt/google/chrome',
    '/snap/bin',
    defaultChromeDir,
    path.join(safeAppInstallDir, 'chrome'),
    safeAppInstallDir
];

const baseDirectories = process.platform === 'win32' ? baseDirsWindows : baseDirsLinux;

function findChromeExecutable(dirs, visitedPaths = new Set(), maxDepth = 3, currentDepth = 0) {
    const globalChromePath = checkGlobalChromePath();
    if (globalChromePath) {
        return globalChromePath;
    }

    const executableName = process.platform === 'win32' ? 'chrome.exe' : 'chrome';

    for (const dir of dirs) {
        if (!fs.existsSync(dir) || currentDepth > maxDepth) {
            continue;
        }

        // Resolve real path to detect symbolic link loops
        let realDir;
        try {
            realDir = fs.realpathSync(dir);
        } catch (error) {
            logger.warn(`Cannot resolve real path for ${dir}: ${error.message}`);
            continue;
        }

        // Skip if we've already visited this real path (prevents loops)
        if (visitedPaths.has(realDir)) {
            logger.debug(`Skipping already visited path: ${realDir}`);
            continue;
        }
        visitedPaths.add(realDir);

        try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const filePath = path.join(dir, file);

                // Skip problematic X11 directories that commonly have symbolic link loops
                if (file === 'X11' && dir.includes('/usr/bin')) {
                    logger.debug(`Skipping potentially problematic X11 directory: ${filePath}`);
                    continue;
                }

                try {
                    const stats = fs.lstatSync(filePath);
                    if (stats.isDirectory() && !stats.isSymbolicLink()) {
                        const subDirResult = findChromeExecutable([filePath], visitedPaths, maxDepth, currentDepth + 1);
                        if (subDirResult) {
                            return subDirResult;
                        }
                    } else if (file === executableName && !stats.isSymbolicLink()) {
                        return filePath;
                    }
                } catch (statError) {
                    logger.debug(`Cannot stat ${filePath}: ${statError.message}`);
                    continue;
                }
            }
        } catch (readError) {
            logger.debug(`Cannot read directory ${dir}: ${readError.message}`);
            continue;
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
        try {
            // Use lstat to avoid following symbolic links that might cause loops
            if (fs.existsSync(chromeExec)) {
                const stats = fs.lstatSync(chromeExec);
                // Only return if it's a regular file or a symbolic link that resolves properly
                if (stats.isFile() || (stats.isSymbolicLink() && fs.existsSync(fs.realpathSync(chromeExec)))) {
                    return chromeExec;
                }
            }
        } catch (error) {
            logger.debug(`Error checking Chrome path ${chromeExec}: ${error.message}`);
            continue;
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

        // Use user home directory for Chrome installation to avoid permission issues
        const userHomeDir = require('os').homedir();
        const userChromeDir = path.join(userHomeDir, '.cache', 'puppeteer');
        
        // Ensure the directory exists
        if (!fs.existsSync(userChromeDir)) {
            fs.mkdirSync(userChromeDir, { recursive: true });
        }

        await install({
            browser: 'chrome',
            buildId: versionInfo.buildId,
            cacheDir: userChromeDir,
        });

        logger.info('Chrome installation completed.');
        existingChromePath = findChromeExecutable([userChromeDir]);
        if (existingChromePath) {
            logger.info(`Installed Chrome found at: ${existingChromePath}`);
            return existingChromePath;
        } else {
            logger.error('Chrome was installed, but executable not found.');
            return null;
        }
    } catch (error) {
        logger.error(`Failed to install Chrome: ${error.message}`);
        logger.info('Attempting fallback installation with latest version...');

        try {
            const userHomeDir = require('os').homedir();
            const userChromeDir = path.join(userHomeDir, '.cache', 'puppeteer');
            
            await install({
                browser: 'chrome',
                buildId: 'latest',
                cacheDir: userChromeDir,
            });

            logger.info('Fallback Chrome installation completed.');
            existingChromePath = findChromeExecutable([userChromeDir]);
            if (existingChromePath) {
                logger.info(`Fallback Chrome found at: ${existingChromePath}`);
                return existingChromePath;
            } else {
                logger.error('Fallback Chrome installation also failed: Chrome executable not found');
                return null;
            }
        } catch (fallbackError) {
            logger.error(`Fallback Chrome installation also failed: ${fallbackError.message}`);
            return null;
        }
    }
}

async function findChromePath() {
    // First, try to fix any symbolic link loops that might prevent Chrome from starting
    try {
        logger.info('Checking for symbolic link loops that might affect Chrome...');
        const fixResults = await fixChromeSymlinkIssues();
        if (fixResults.fixed.length > 0) {
            logger.info(`Fixed ${fixResults.fixed.length} symbolic link loops`);
        }
    } catch (error) {
        logger.warn('Could not fix symbolic link loops:', error.message);
        // Continue anyway, as this might not be critical
    }

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
