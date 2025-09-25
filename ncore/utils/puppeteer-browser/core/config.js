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
const fs = require('fs');
const UserAgent = require('user-agents');
const logger = require('#@logger');
const gconfig = require('#@gconfig');
const global_vars = require('#@global_vars');

class PuppeteerSpiderConfig {
    constructor() {
        this.defaultConfig = {
            // Browser launch options
            headless: false,
            devtools: false,
            mute: true,
            disableGpu: true,
            showImages: false,
            showStyle: true,
            
            // Viewport settings
            width: 1280,
            height: 720,
            deviceScaleFactor: 1,
            mobile: false,
            
            // User agent
            randomUserAgent: true,
            userAgent: null,
            
            // Timeout and wait settings
            timeout: 50000,
            waitForComplete: true,
            
            // URL handling
            urlStrict: false,
            
            // Proxy settings
            proxy: null,
            
            // Chrome executable path
            executablePath: null,
            
            // Download settings
            downloadPath: null,
            
            // Logging
            logging: false,
            
            // Stealth settings
            stealthJsPath: null
        };

        // Preset modes
        this.presetModes = {
            // Server mode: headless, no images, no CSS, muted, GPU disabled
            server: {
                headless: true,
                showImages: false,
                showStyle: false,
                mute: true,
                disableGpu: true,
                mobile: false,
                width: 1280,
                height: 720
            },
            
            // Desktop mode: not headless, show images, show CSS, muted, GPU disabled
            desktop: {
                headless: false,
                showImages: true,
                showStyle: true,
                mute: true,
                disableGpu: true,
                mobile: false,
                width: 1280,
                height: 720
            },
            
            // Mobile mode: not headless, show images, show CSS, muted, GPU disabled, mobile emulation
            mobile: {
                headless: false,
                showImages: true,
                showStyle: true,
                mute: true,
                disableGpu: true,
                mobile: true,
                width: 375,
                height: 667,
                deviceScaleFactor: 2
            }
        };
    }

    /**
     * Initialize configuration with default values
     * @param {Object} customConfig - Custom configuration to merge
     * @param {string} presetMode - Preset mode (server, desktop, mobile)
     * @returns {Object} Merged configuration
     */
    async initPuppeteerSpiderConfig(customConfig = {}, presetMode = null) {
        let config = { ...this.defaultConfig };
        
        // Apply preset mode if specified
        if (presetMode && this.presetModes[presetMode]) {
            config = { ...config, ...this.presetModes[presetMode] };
        }
        
        // Merge custom config
        config = { ...config, ...customConfig };
        
        // Set user agent
        if (!config.userAgent) {
            config.userAgent = config.mobile ? this.getMobileUserAgent() : this.getPCUserAgent();
        }
        
        // Set executable path if not provided
        if (!config.executablePath) {
            const chromeFinder = require('./chrome-finder.js');
            const chromeInfo = await chromeFinder.findPuppeteerCompatibleChrome();
            config.executablePath = chromeInfo ? chromeInfo.path : null;
        }
        
        // Set download path
        if (!config.downloadPath) {
            config.downloadPath = path.join(global_vars.CACHE_DIR, 'puppeteer_spider_downloads');
        }
        
        // Set stealth.js path
        if (!config.stealthJsPath) {
            config.stealthJsPath = path.resolve(path.join(__dirname, '../oldspider/library/libs/stealth.min.js'));
        }
        
        return config;
    }

    /**
     * Build Chrome launch arguments for Puppeteer
     * @param {Object} config - Configuration object
     * @returns {Array} Chrome arguments array
     */
    buildPuppeteerChromeArgs(config) {
        const {
            disableGpu,
            proxy,
            mute,
            width,
            height,
            headless,
            showImages,
            showStyle
        } = config;

        const args = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--disable-default-apps',
            '--disable-extensions',
            '--disable-plugins',
            '--disable-sync',
            '--disable-translate',
            '--hide-scrollbars',
            '--mute-audio',
            '--no-default-browser-check',
            '--no-pings',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--ignore-ssl-errors',
            '--disable-infobars',
            `--window-size=${width},${height}`,
            '--lang=zh-CN',
            '--user-data-dir',
            '--trusted-download-sources',
            '--disable-features=site-per-process',
            '--incognito'
        ];

        // Add GPU disable if specified
        if (disableGpu) {
            args.push('--disable-gpu');
            if (!showImages) {
                args.push('--blink-settings=imagesEnabled=false');
            }
        }

        // Add proxy if specified
        if (proxy) {
            args.push(`--proxy-server=${proxy}`);
        }

        // Add mute if specified
        if (mute) {
            args.push('--mute-audio');
        }

        // Add headless if specified
        if (headless) {
            args.push('--disable-gpu');
        }

        // Add download path
        if (config.downloadPath) {
            args.push(`--download.default_directory=${config.downloadPath}`);
        }

        // Add mobile emulation if specified
        if (config.mobile) {
            args.push('--user-agent=' + this.getMobileUserAgent());
        }

        return args;
    }

    /**
     * Build Chrome ignore arguments for Puppeteer
     * @param {boolean} mute - Whether to mute audio
     * @returns {Array} Arguments to ignore
     */
    buildPuppeteerChromeIgnoreArgs(mute = true) {
        const ignoreArgs = [
            '--enable-automation',
            '--enable-blink-features=IdleDetection',
            'enable-logging'
        ];

        if (mute) {
            ignoreArgs.push('--disable-audio');
        }

        return ignoreArgs;
    }

    /**
     * Get PC user agent for Puppeteer
     * @returns {string} PC user agent string
     */
    getPCUserAgent() {
        if (this.defaultConfig.randomUserAgent) {
            const userAgent = new UserAgent({ deviceCategory: 'desktop' });
            const randomUserAgent = userAgent.random();
            return randomUserAgent.toString();
        } else {
            return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
        }
    }

    /**
     * Get mobile user agent for Puppeteer
     * @returns {string} Mobile user agent string
     */
    getMobileUserAgent() {
        if (this.defaultConfig.randomUserAgent) {
            const userAgent = new UserAgent({ deviceCategory: 'mobile' });
            const randomUserAgent = userAgent.random();
            return randomUserAgent.toString();
        } else {
            return "Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1";
        }
    }

    /**
     * Find Chrome executable path for Puppeteer
     * @returns {Object|null} Chrome info object or null
     */
    async findPuppeteerCompatibleChrome() {
        const chromeFinder = require('./chrome-finder.js');
        return await chromeFinder.findPuppeteerCompatibleChrome();
    }

    /**
     * Get preset mode configuration
     * @param {string} mode - Preset mode name
     * @returns {Object|null} Preset configuration or null
     */
    getPresetMode(mode) {
        return this.presetModes[mode] || null;
    }

    /**
     * Get available preset modes
     * @returns {Array} Array of preset mode names
     */
    getAvailablePresetModes() {
        return Object.keys(this.presetModes);
    }
}

module.exports = new PuppeteerSpiderConfig(); 