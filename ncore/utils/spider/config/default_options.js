'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const UserAgent = require('user-agents');
const {ensureChrome,findChromeExecutable} = require('../utils/driver/ensureChrome.js'); // 导入 ensureChrome 

let baseDir = path.join(__dirname, '..');
let setBaseDirToken = null;

const defaultOptions = {
    devtools: false,
    mobile: false,
    disableGpu: true,
    proxy: null,
    random_user_agent: true,
    headless: false,
    waitForComplete: true,
    timeout: 50000,
    logging: false,
    mute: true,
    showImages: false,
    showStyle: true,
    urlStrict: false,
    userAgent: '',
    stealth_js: '',
    executablePath: '',
    width: 1920,
    height: 1080,
};

function setBaseDir(newBaseDir) {
    baseDir = newBaseDir;
    setBaseDirToken = true;
}

function getBaseDir(file) {
    if (file) file = path.join(baseDir, file);
    return file;
}

function getLibrary(file) {
    if (setBaseDirToken) {
        const exefile = findChromeExecutable(baseDir);
        if (exefile) return exefile;
    }
    let libraryDir = getBaseDir(`library`);
    if (file) file = path.join(libraryDir, file);
    return file;
}

function getBaseSubDir(subdir) {
    return path.join(baseDir, subdir);
}

async function initConfig() {
    const config = { ...defaultOptions };
    config.userAgent = config.mobile ? getMobileUserAgent() : getPCUserAgent();
    config.stealth_js = getLibrary('libs/stealth.min.js');
    config.width = config.mobile ? 320 : 1920;
    config.height = config.mobile ? 568 : 1080;
    
    try {
        const chromePath = await ensureChrome();
        if (chromePath) {
            config.executablePath = chromePath;
        } else {
            console.error('Failed to ensure Chrome. Using default path.');
        }
    } catch (error) {
        console.error('Error ensuring Chrome:', error);
    }
    
    return config;
}

async function iniOptions(config, type = 'puppeteer', chromeOptions) {
    if (type === 'puppeteer') {
        return iniOptionsPuppeteer(config);
    } else if (type === 'puppeteer') {
        return await iniOptionsPuppeteer(chromeOptions, config);
    }
}

function buildChromeArgs(config) {
    const {
        disableGpu,
        proxy,
        mute,
        width,
        height,
        headless
    } = config;

    const args = [
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list',
        '--ignore-ssl-errors',
        '--disable-infobars',
        '--no-sandbox',
        '--mute-audio',
        `--window-size=${width},${height}`,
        '--lang=zh-CN',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--user-data-dir',
        '--trusted-download-sources',
        '--disable-features=site-per-process',
        '--disable-setuid-sandbox',
    ];

    if (disableGpu) {
        args.push('--disable-gpu');
        args.push('--blink-settings=imagesEnabled=false');
    }

    if (proxy) args.push(`--proxy-server=${proxy}`);
    if (mute) args.push('--mute-audio');
    if (headless) args.push('--disable-gpu');

    return args;
}

async function iniOptionsPuppeteer(chromeOptions, config) {
    chromeOptions.ignoreHTTPSErrors = true;
    chromeOptions.excludeSwitches = ['enable-automation', 'enable-logging'];
    chromeOptions.experimental.detach = true;

    const defaultDownloadPath = getDefaultDownloadPath();
    await mkdir(defaultDownloadPath);

    chromeOptions.experimental.prefs = {
        'profile.default_content_settings.popups': 0,
        'download.default_directory': defaultDownloadPath,
        'profile.default_content_setting_values.automatic_downloads': 1
    };

    chromeOptions.args.push(...buildChromeArgs(config));

    return chromeOptions;
}

function iniOptionsPuppeteer(config) {
    const args = buildChromeArgs(config);
    if (config.devtools) args.push('--auto-open-devtools-for-tabs');
    return args;
}

function getPCUserAgent() {
    if (defaultOptions.random_user_agent) {
        const userAgent = new UserAgent({ deviceCategory: 'desktop' });
        const randomUserAgent = userAgent.random();
        return randomUserAgent.toString();
    } else {
        return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
    }
}

function getMobileUserAgent() {
    if (defaultOptions.random_user_agent) {
        const userAgent = new UserAgent({ deviceCategory: 'mobile' });
        const randomUserAgent = userAgent.random();
        return randomUserAgent.toString();
    } else {
        return "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1";
    }
}

function getDefaultDownloadPath() {
    const homeDir = os.homedir();
    if (process.platform === 'win32') {
        return path.join(homeDir, 'Downloads');
    } else {
        return path.join(homeDir, 'Downloads');
    }
}

async function mkdir(dir) {
    return new Promise((resolve, reject) => {
        fs.mkdir(dir, { recursive: true }, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

module.exports = {
    setBaseDir,
    getBaseDir,
    getLibrary,
    getBaseSubDir,
    initConfig,
    iniOptions,
    buildChromeArgs,
    iniOptionsPuppeteer,
    getPCUserAgent,
    getMobileUserAgent,
    defaultOptions,
    getDefaultDownloadPath
};
