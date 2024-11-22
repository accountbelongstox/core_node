'use strict';
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const { DriverInterface } = require('../interface/driver_interface.js');
const Page = require('./modus/page.js')
const Handle = require('./modus/handle.js')
const Download = require('./modus/download.js')
const Screen = require('./modus/screen.js')
const Content = require('./modus/content.js');
const {initConfig, getMobileUserAgent, iniOptions} = require('../config/options.js');
const { version } = require('puppeteer/package.json');
const fs = require('fs');
const path = require('path');

class PuppeteerDriver extends DriverInterface {
    constructor() {
        super();
        this.bypass();
    }

    bypass() {
        puppeteer.use(StealthPlugin())
    }

    async documentInitialised() {
        const driver = await this.getDriver();
        const outerHTML = await driver.evaluate(() => document.documentElement.outerHTML);
        if (outerHTML != null && outerHTML.length > 0) {
            console.log(`outerHTML${outerHTML.length}`);
        }
        return driver;
    }

    async checkFileAccessibility(filePath) {
        try {
            // 尝试以二进制方式读取文件
            await fs.promises.readFile(filePath);
            
            // 尝试打开文件进行写入（不实际写入）
            const fd = await fs.promises.open(filePath, 'r+');
            await fd.close();
            
            console.log(`File ${filePath} is accessible and writable.`);
            return true;
        } catch (error) {
            console.error(`Error accessing file ${filePath}: ${error.message}`);
            return false;
        }
    }

    async createChromeDriver(userOptions = {headless: true}) {
        const config = await initConfig();
        const customConfig = {...config, ...userOptions};
        const {
            devtools,
            mobile,
            userAgent,
            mute,
            width,
            height,
            deviceScaleFactor,
            executablePath,
            headless
        } = customConfig;

        // 检查 executablePath 是否可访问
        if (executablePath) {
            const isAccessible = await this.checkFileAccessibility(executablePath);
            if (!isAccessible) {
                console.warn(`Warning: Chrome executable at ${executablePath} may not be accessible.`);
            }
        }

        const args = await iniOptions(customConfig, 'puppeteer');

        const defaultViewport = {
            width,
            height,
            deviceScaleFactor,
            isMobile: mobile,
            userAgent: mobile ? getMobileUserAgent() : userAgent,
        };

        console.log(`puppeteer. launch by headless:${headless}`);
        console.log({
            headless,
            args,
            defaultViewport,
            devtools,
            executablePath,
            ignoreDefaultArgs: mute ? ['--mute-audio'] : []
        });

        let nativeDriver;
        const launchTimeout = 30000; // 30 seconds timeout
        const launchStart = Date.now();

        try {
            nativeDriver = await Promise.race([
                puppeteer.launch({
                    headless,
                    args,
                    defaultViewport,
                    devtools,
                    executablePath,
                    ignoreDefaultArgs: mute ? ['--mute-audio'] : []
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Launch timeout')), launchTimeout)
                )
            ]);
        } catch (error) {
            if (error.message === 'Launch timeout') {
                console.error('Chrome launch timed out. This might be due to permission issues or incorrect installation.');
                if (executablePath) {
                    const parentDir = path.dirname(executablePath);
                    console.error(`Consider deleting the directory ${parentDir} and reinstalling Chrome.`);
                }
                console.error('Possible reasons:');
                console.error('1. Insufficient permissions');
                console.error('2. Incorrect Chrome installation');
                console.error('3. Antivirus software blocking Chrome');
                throw error;
            }
            throw error;
        }

        const launchDuration = Date.now() - launchStart;
        console.log(`Chrome launched in ${launchDuration}ms`);

        const browserVersion = await nativeDriver.version();
        const browserInfo = await nativeDriver.userAgent();
        const chromeInfo = {
            version: browserVersion,
            userAgent: browserInfo,
            headless: headless,
            executablePath: executablePath || 'default',
        };

        const page = new Page(nativeDriver, customConfig);
        const handle = new Handle(nativeDriver, page);
        const content = new Content(nativeDriver, page);
        const download = new Download(nativeDriver, page);
        const screen = new Screen(nativeDriver, page);
        const customs = {
            nativeDriver,
            page,
            content,
            handle,
            download,
            screen,
            version,
            chrome:chromeInfo,
            close: page.closeWindow,
            config: customConfig,
        }; 
        const browser = customs;
        return {
            driver:nativeDriver,
            browser,
            version,
            chrome:chromeInfo,
            ...customs
        };
    }
}

PuppeteerDriver.toString = () => '[class PuppeteerDriver]';
module.exports = PuppeteerDriver;
