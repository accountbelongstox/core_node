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
// const fs = require('fs');
// const path = require('path');
// const { promisify } = require('util');
// const writeFileAsync = promisify(fs.writeFile);
const { exec } = require('child_process');
// const util = require('util');
// const rimraf = promisify(require('rimraf'));
// const { Builder, By, Key, Capabilities, until, Select, Actions, WebDriver } = require('selenium-webdriver');
// const chrome = require('selenium-webdriver/chrome');
// const edge = require('selenium-webdriver/edge');
// const chromedriver = require('chromedriver');
// const edgedriver = require('edgedriver');
// const decompress = require('decompress');
const driversDict = {}
const PuppeteerDriver = require('../climber/puppeteer/driver')
// const SeleniumDriver = require('./climber/selenium/driver')
const Util = require('../../node_provider/utils');
const {opt} = require('../../node_provider/practicals');
let config = opt.initConfig()

class Browser {
    driver = null;
    driverRemoteUrl;

    constructor(conf = {}) {
        config =jsontool.merge(config, conf)
    }

    async createDriver(options = {headless:false}) {
        config =jsontool.merge(config, options)
        console.log(`config`)
        console.log(config)
        const driver = await this.createPlatfromDriver(config);
        return driver;
    }

    async createPlatfromDriver(options) {
        if (Util.platform.isWindows()) {
            this.driver = await new PuppeteerDriver().createChromeDriver(options)
        } else {
            this.driver = await new SeleniumDriver().createChromeDriver(options)
        }
        return this.driver
    }

    init(args) {
        this.driverName = String(args);
        driversDict[this.driverName] = null;
        this.driverRemoteUrl = {
            'chrome': 'https://example.com/chrome/',
            'edge': 'https://example.com/edge/',
            // 添加更多的驱动类型和对应的远程 URL
        };
    }

    async getUtil(){
        return Util;
    }

    async isReady() {
        await this.sleep(100); // 0.1秒
        if (await this.getCurrentURL() === "about:blank") {
            return false;
        }
        const js = "return document.readyState";
        const ready = await this.executeJS(js);
        return ready === "complete";
    }

    async openReadyWait() {
        if (!(await this.isReady())) {
            await this.sleep(1000); // 1秒
            console.log("openReadyWait");
            return this.openReadyWait();
        } else {
            return true;
        }
    }

    async openLocalHtmlToBeautifulSoup(htmlName = 'index.html') {
        const content = this.comFile.loadHtml(htmlName);
        const beautifulSoup = this.comHttp.findTextFromBeautifulSoup(content);
        return beautifulSoup;
    }

    isExistsDriver() {
        if (
            driversDict[this.driverName] !== null &&
            this.driver !== null &&
            driversDict[this.driverName] === this.driver
        ) {
            return this.driver;
        } else {
            return false;
        }
    }

    async getDriver() {
        const isExistsDriver = this.isExistsDriver();
        if (isExistsDriver !== false) {
            return this.driver;
        }
        this.driver = Driver.getBrowserDriver()
        this.setDriver(driver);
        return driver;
    }

    async getWindowPosition() {
        const driver = this.getDriver();
        const position = await driver.getWindowPosition();
        return position;
    }


    async getWindowsRegistryValue(keyPath, valueName) {//getChromeVersion的附属方法
        const { stdout } = await exec(`reg query "${keyPath}" /v "${valueName}"`);
        const matches = stdout.match(/REG_SZ\s+(.*)/);
        return matches && matches[1];
    }


    async setDriver(driver) {
        global.driversDict[this.driverName] = null;
        global.driversDict[this.driverName] = driver;
        this.driver = global.driversDict[this.driverName];
        return this.driver;
    }

    async testBot(driverType) {
        await this.open('https://bot.sannysoft.com/', driverType);
    }

    async sleep(milliseconds) {//调用sleep
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }

    async waitElement(selector, timeout = 10000, deep = 0) {
        if (timeout >= deep) {
            return false;
        }

        try {
            const element = await driver.findElement(By.css(selector));
            return true;
        } catch (error) {
            // 如果找不到元素，则等待一秒钟继续尝试
            await new Promise(resolve => setTimeout(resolve, 1000));
            deep++;
            return waitElement(selector, timeout, deep);
        }
    }


    async isShow(selector) {
        const offsetParent = await this.findAttrByJs(selector, 'offsetParent');
        return !offsetParent;
    }

    async isComplete(src, wait = 10) {
        const jsCode = `return document.querySelector('[src="${src}"]').complete;`;
        let index = 0;
        let complete = await this.executeJsCode(jsCode);

        while (complete !== true && index < wait) {
            index += 1;
            await new Promise(resolve => setTimeout(resolve, 1000)); // 等待 1 秒
            complete = await this.executeJsCode(jsCode);
        }

        return complete;
    }
}

Browser.toString = () => '[class Browser]';
module.exports = Browser;

