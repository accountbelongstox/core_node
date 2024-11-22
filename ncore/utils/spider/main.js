'use strict';
const { exec } = require('child_process');
const PuppeteerDriver = require('./climber/driver.js');
const Util = require('./provider/utils.js');
const { initConfig } = require('./config/default_options.js');
const driverStore = require('./utils/driver/driverStore.js');
const { driversDict } = require('./globalvar/globalvars.js');
class Browser {
    constructor(conf = {}) {
        this.config = Util.json.merge(initConfig(), conf);
    }

    async createDrivers(options = { headless: false, instances: 2 }) {
        this.config = Util.json.merge(this.config, options);
        const instances = this.config.instances || 2;

        if (!Util.platform.isWindows() && this.config.headless === undefined) {
            this.config.headless = true;
        }

        for (let i = 0; i < instances; i++) {
            const offsetX = 50 * i;
            const offsetY = 50 * i;
            
            const modifiedOptions = {
                ...this.config,
                args: [
                    ...(this.config.args || []),
                    `--window-position=${offsetX},${offsetY}`
                ]
            };

            const driver = await this.createDriver(modifiedOptions);
            driverStore.addDriver(driver);
        }

        return driverStore.getAllDrivers();
    }

    async createDriver(options = {}) {
        const headless = Util.platform.isLinux() ? true : options.headless !== undefined ? options.headless : false;
        return await new PuppeteerDriver().createChromeDriver({ ...options, headless });
    }
    

    async getBrowser(options = {},indentfier=0) {
        const existingDriver = driverStore.getDriver(indentfier);
        if (existingDriver) {
            return existingDriver;
        }
        const newDriver = await this.createDriver(options);
        driverStore.addDriver(newDriver);
        return newDriver;
    }

    async getBrowsers(options = { instances: 2 }) {
        const existingDrivers = driverStore.getAllDrivers();
        if (existingDrivers.length >= options.instances) {
            return existingDrivers.slice(0, options.instances);
        }
        const newDrivers = await this.createDrivers(options);
        return newDrivers;
    }

    async getDriver(index = 0) {
        return driverStore.getDriver(index);
    }

    isExistsDriver(driverName) {
        if (
            driversDict[driverName] !== null &&
            driversDict[driverName] !== null &&
            driversDict[driverName] === this.driver
        ) {
            return this.driver;
        } else {
            return false;
        }
    }

    async setDriver(driver,driverName) {
        driversDict[driverName] = null;
        driversDict[driverName] = driver;
        this.driver = driversDict[driverName];
        return this.driver;
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
const browser = new Browser();
module.exports = {
    browser,
    Browser
};