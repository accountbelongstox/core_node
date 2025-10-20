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
const path = require('path');
const fs = require('fs')
const UserAgent = require('user-agents');
const gconfig = require('#@gconfig');
const { cwd } = require('#@global_vars');
const { findChromePath } = require('./libs/ensureAndFinderChrome.js')
const { file } = require('#@ncore/foundation/utilities/index.js')
const logger = require('#@logger')
const stealth_js = path.resolve(path.join(__dirname, '../library/libs/stealth.min.js'))
const { getScreenInfo } = require('#@ncore/global_vars/libs/system_info.js')

class Options {
    baseDir = cwd
    setBaseDirToken = null
    defaultOptions = {
        devtools: false,
        mobile: false,
        disableGpu: true,
        proxy: null,
        random_user_agent: true,
        headless: false,
        waitForComplete: true,
        timeout: 50000,
        logging: false,
        // userAgent:,
        mute: true,
        showImages: false,
        showStyle: true,
        // width: ,
        // height: ,
        urlStrict: false,
        // deviceScaleFactor:,
        // stealth_js:,
        // executablePath: 
    }

    constructor() {
    }

    setBaseDir(baseDir) {
        this.baseDir = baseDir
        this.setBaseDir = true
    }

    getBaseDir(file) {
        if (file) file = path.join(this.baseDir, file)
        return file
    }

    async getLibrary(file) {
        if (this.setBaseDirToken) {
            const exefile = await findChromePath();
            if (exefile) return exefile;
        }
        let libraryDir = this.getBaseDir(`library`)
        if (file) file = path.join(libraryDir, file)
        return file
    }

    getBaseSubDir(subdir) {
        return path.join(this.baseDir, subdir);
    }

    async initConfig() {
        this.defaultOptions.userAgent = this.defaultOptions.mobile ? this.getMobileUserAgent() : this.getPCUserAgent()
        this.defaultOptions.stealth_js = stealth_js
        this.defaultOptions.executablePath = await findChromePath()
        // this.defaultOptions.deviceScaleFactor = this.defaultOptions.mobile ? 2 : 1
        //https://peter.sh/experiments/chromium-command-line-switches/
        if (!this.defaultOptions.executablePath || !file.isFile(this.defaultOptions.executablePath)) {
            logger.error(`Not found chrome executable path from ${this.defaultOptions.executablePath}`)
        }
        if (!file.isFile(this.defaultOptions.stealth_js)) {
            logger.error(`Not found stealth.min.js from ${this.defaultOptions.stealth_js}`)
        }
        let newResolutionX = 1280;
        let newResolutionY = 720;
        try {
            const screenInfo = await getScreenInfo()
            const { resolutionX, resolutionY } = screenInfo[0];
            console.log(`Screen Resolution: ${resolutionX}x${resolutionY}`);

            
            newResolutionX = Math.floor(resolutionX * 0.6);
            newResolutionY = Math.floor(resolutionY * 0.6);

            if (resolutionX >= 2560) {
                newResolutionX = 1920;
                newResolutionY = 1080;
            }

            if (newResolutionX > 1280) {
                newResolutionX = 1280;
                newResolutionY = Math.floor((newResolutionX / resolutionX) * resolutionY);  // 保持宽高比
            }
            if (newResolutionY > 720) {
                newResolutionY = 720;
                newResolutionX = Math.floor((newResolutionY / resolutionY) * resolutionX);  // 保持宽高比
            }
        } catch (e) {
            logger.warn('⚠️ Warning: System-Info: `systeminformation` module is not installed or failed to load. Using default screen size.');
        }
        console.log(`New Resolution: ${newResolutionX}x${newResolutionY}`);
        if (this.defaultOptions.mobile) {
            this.defaultOptions.width = 320;
            this.defaultOptions.height = 568;
        } else {
            this.defaultOptions.width = newResolutionX || 1280;
            this.defaultOptions.height = newResolutionY || 720;
        }
        return this.defaultOptions
    }

    buildChromeArgs(config) {
        const {
            disableGpu,
            proxy,
            mute,
            width,
            height,
            headless
        } = config;

        const args = [
            // '--ignore-certificate-errors', no supported in puppeteer
            // '--ignore-certificate-errors-spki-list', no supported in puppeteer
            '--ignore-ssl-errors',
            '--disable-infobars',
            `--window-size=${width},${height}`,
            // '--incognito',
            '--lang=zh-CN',
            '--disable-web-security',
            '--user-data-dir',
            '--trusted-download-sources',
            '--disable-features=site-per-process',
            // '--disable-blink-features=AutomationControlled', // no supported in puppeteer
            '--disable-web-security',
            `--incognito`,
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

    buildChromeIgnoreArgs(mute) {
        const ignoreArgs = ['--enable-automation', 'enable-logging'];
        if (mute) ignoreArgs.push('--mute-audio');
        return ignoreArgs;
    }

    async iniOptionsSelenium(chromeOptions, config) {
        chromeOptions.ignoreHTTPSErrors = true;
        chromeOptions.excludeSwitches = ['enable-automation', 'enable-logging'];
        chromeOptions.experimental.detach = true;

        const defaultDownloadPath = gconfig.DOWNLOAD_DIR;
        fs.mkdirSync(defaultDownloadPath, { recursive: true });

        chromeOptions.experimental.prefs = {
            'profile.default_content_settings.popups': 0,
            'download.default_directory': defaultDownloadPath,
            'profile.default_content_setting_values.automatic_downloads': 1
        };

        chromeOptions.args.push(...this.buildChromeArgs(config));

        return chromeOptions;
    }

    async iniArgs(config, mute = true) {
        logger.info(``)
        const args = this.buildChromeArgs(config);
        const ignoreDefaultArgs = this.buildChromeIgnoreArgs(mute);
        if (config.devtools) args.push('--auto-open-devtools-for-tabs');
        return { args, ignoreDefaultArgs };
    }


    getPCUserAgent() {
        if (this.defaultOptions.random_user_agent) {
            const userAgent = new UserAgent({ deviceCategory: 'desktop'/*platform: 'Win32'*/ });
            const randomUserAgent = userAgent.random();
            // console.log(`randomUserAgent`)
            // console.log(randomUserAgent)
            const randomUserString = randomUserAgent.toString();
            return randomUserString
        } else {
            return "Mozilla/5.0 (Linux; Android 4.2.1; en-us; Nexus 5 Build/JOP40D) AppleWebKit/535.19 (KHTML, like Gecko) Chrome/18.0.1025.166 Mobile Safari/535.19"
        }
    }

    getMobileUserAgent() {
        if (this.defaultOptions.random_user_agent) {
            const userAgent = new UserAgent({ deviceCategory: 'mobile' });
            const randomUserAgent = userAgent.random();
            // console.log(`randomUserAgent`)
            // console.log(randomUserAgent)
            const randomUserString = randomUserAgent.toString();
            return randomUserString
        } else {
            return `'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1'`
        }
    }
}


Options.toString = () => '[class Options]';
module.exports = new Options();

