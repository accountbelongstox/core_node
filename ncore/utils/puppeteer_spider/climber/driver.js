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
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const Page = require('./modus/page');
const Handle = require('./modus/handle');
const Download = require('./modus/download');
const Screen = require('./modus/screen');
const Content = require('./modus/content');
const FileMonitor = require('./modus/file_monitor');
const Options = require('../config/option.js');
const { jsontool } = require('#@ncore/foundation/utilities/index.js');
const logger = require('#@logger');
const driverStore = require('../library/driverStore.js');
const { isWindows, isLinux } = require('#@global_vars');
let config = null;

class PuppeteerDriver {
    static DriverId = 0
    constructor(conf = {}) {
        this.config = jsontool.merge(Options.initConfig(), conf);
    }

    async loadConfig() {
        if (!config) {
            config = await Options.initConfig();
        }
        return config;
    }

    enableStealthMode() {
        puppeteer.use(StealthPlugin());
    }

    async createDriver(options = {}, identifier = 'default') {
        const driverId = PuppeteerDriver.DriverId++;
        logger.info(`Creating driver with identifier: ${identifier || driverId}`);

        const config = await this.loadConfig();
        const customConfig = jsontool.merge(config, options);
        this.enableStealthMode();

        const { args, ignoreDefaultArgs } = await Options.iniArgs(customConfig, customConfig.mute);
        const defaultViewport = {
            width: customConfig.width,
            height: customConfig.height,
            deviceScaleFactor: customConfig.deviceScaleFactor,
            isMobile: customConfig.mobile,
            userAgent: customConfig.mobile ? Options.getMobileUserAgent() : customConfig.userAgent,
        };

        const launchOptions = {
            headless: isLinux ? true : customConfig.headless,
            args,
            defaultViewport,
            devtools: customConfig.devtools,
            executablePath: customConfig.executablePath,
            ignoreDefaultArgs,
        };

        const puppeteerBrowser = await puppeteer.launch(launchOptions);
        logger.info(`Driver ${driverId} initialized`);

        // Encapsulated page functionality
        const encapsulatedPageFuncs = new Page();
        await encapsulatedPageFuncs.init(puppeteerBrowser, config);

        // Encapsulated handle functionality
        const encapsulatedHandleFuncs = new Handle();
        await encapsulatedHandleFuncs.init(puppeteerBrowser, encapsulatedPageFuncs);  // Updated to reflect page as the boss

        // Encapsulated content functionality
        const encapsulatedContentFuncs = new Content();
        await encapsulatedContentFuncs.init(puppeteerBrowser, encapsulatedPageFuncs);  // Updated here as well

        // Encapsulated download functionality
        const encapsulatedDownloadFuncs = new Download();
        await encapsulatedDownloadFuncs.init(puppeteerBrowser, encapsulatedPageFuncs);  // Updated here as well

        // Encapsulated screen functionality
        const encapsulatedScreenFuncs = new Screen();
        await encapsulatedScreenFuncs.init(puppeteerBrowser, encapsulatedPageFuncs);  // Updated here as well

        // File monitor functionality
        const fileMonitor = new FileMonitor();

        const driverObject = {
            identifier,
            driverId,
            puppeteerBrowser,
            encapsulatedPageFuncs,
            encapsulatedContentFuncs,
            encapsulatedHandleFuncs,
            encapsulatedDownloadFuncs,
            encapsulatedScreenFuncs,
            fileMonitor,
            extendedCloseMethod: encapsulatedPageFuncs.closeWindow,
        };

        driverStore.addDriver(driverObject);
        return driverObject;

    }

    async createDrivers(options = { headless: false, instances: 1 }) {
        this.config = jsontool.merge(this.config, options);
        const instances = this.config.instances || 1;
        const drivers = [];

        if (!isWindows && this.config.headless === undefined) {
            this.config.headless = true;
        }

        for (let i = 0; i < instances; i++) {
            const offsetX = 50 * i;
            const offsetY = 50 * i;

            const modifiedOptions = {
                ...this.config,
                args: [...(this.config.args || []), `--window-position=${offsetX},${offsetY}`],
            };

            const driver = await this.createDriver(modifiedOptions, `instance-${i}`);
            drivers.push(driver);
        }

        return drivers;
    }

    async getBrowser(options = {}) {
        const existingDriver = driverStore.getDriver('default');
        if (existingDriver) return existingDriver;
        return await this.createDriver(options, 'default');
    }

    async getBrowsers(options = { instances: 2 }) {
        const existingDrivers = driverStore.getAllDrivers();
        if (existingDrivers.length >= options.instances) {
            return existingDrivers.slice(0, options.instances);
        }
        return await this.createDrivers(options);
    }

    async getDriver(index = 0) {
        return driverStore.getDriver(index);
    }
}

PuppeteerDriver.toString = () => '[class PuppeteerDriver]';
module.exports = PuppeteerDriver;
