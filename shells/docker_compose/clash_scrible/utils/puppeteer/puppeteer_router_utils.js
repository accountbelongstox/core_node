const { checkPuppeteerAvailability, getBrowser } = require('./puppeteer_base_utils');
const { ROUTOR_DOMAIN, puppeteer_dir } = require('../../provider/global_var');
const logger = require('../log_utils');
const { result } = require('lodash');
const { env } = require('../../node_spider/node_provider/utils');
const ROUTER_USER = env.getEnv(`ROUTER_USER`) || `root`
const ROUTER_PWD = env.getEnv(`ROUTER_PWD`)
function standardPuppeteerOperation(func) {
    return async function (...args) {
        const [driver, message] = await getBrowser();
        if (!driver) {
            return { success: false, message: message, data: null };
        }
        try {
            const { success, message, data } = await func(driver, ...args);
            driver.screen.setSaveDir(puppeteer_dir);
            const screenshotFullPath = await driver.screen.screenshotFullPage();
            let relativeScreenshotPath = screenshotFullPath.replace(puppeteer_dir, '');
            relativeScreenshotPath = relativeScreenshotPath.replace(/^[/\\;]+|[/\\;]+$/g, '');
            const screenshot = `/static/${relativeScreenshotPath.trim()}`;
            return {
                success,
                message,
                data: {
                    result: data,
                    screenshot
                },

            };
        } catch (e) {
            return { success: false, message: `Operation failed: ${e.toString()}`, data: null, screenshot: null };
        }
    };
}
const closeExtraWindows = standardPuppeteerOperation(async function (driver) {
    try {
        const pages = await driver.page.getPages();
        while (pages.length > 3) {
            await driver.page.closePage(pages[pages.length - 1].url());
        }
        await driver.page.switchToPageByIndex(0);
        return { success: true, message: "Extra windows closed", data: null };
    } catch (error) {
        return { success: false, message: `Failed to close extra windows: ${error}`, data: null };
    }
});
const checkLoginStatus = standardPuppeteerOperation(async function (driver) {
    try {
        const initialIndex = await driver.page.getCurrentPageIndex();

        await driver.page.open_single(ROUTOR_DOMAIN);

        const newIndex = await driver.page.getCurrentPageIndex();

        const logged_in = await driver.content.queryAllElements('.logged-in');
        console.log(`logged_in`, logged_in)
        if (logged_in) {
            if (initialIndex !== newIndex) {
                await driver.page.switchToPageByIndex(initialIndex);
            }
            return { success: true, message: "Already logged in", data: true };
        } else {
            if (initialIndex !== newIndex) {
                await driver.page.closePageByIndex(initialIndex);
            }
            return { success: false, message: "Not logged in", data: false };
        }
    } catch (error) {
        return { success: false, message: `Error checking login status: ${error}`, data: null };
    }
});
const login = standardPuppeteerOperation(async function (driver) {
    const { success: loginStatus, message: loginMessage } = await checkLoginStatus(driver);
    console.log(`loginStatus`, loginStatus, `loginMessage`, loginMessage)
    if (!loginStatus) {
        await driver.page.open_single(ROUTOR_DOMAIN);
        await driver.handle.type('input[name="luci_username"]', ROUTER_USER);
        await driver.handle.type('input[name="luci_password"]', ROUTER_PWD);
        await driver.handle.triggerBySelector('input[type="submit"][value="登录"]', 'click');
        return { success: true, message: "Login successful", data: true };
    }
    return { success: true, message: "Already logged in", data: true };
});
const openWebsite = standardPuppeteerOperation(async function (driver) {
    try {
        await driver.page.open_single(ROUTOR_DOMAIN);
        await driver.content.waitForElement('body');
        return { success: true, message: "Website opened successfully", data: true };
    } catch (error) {
        return { success: false, message: `Failed to open website: ${error}`, data: false };
    }
});
const openOpenclash = standardPuppeteerOperation(async function (driver) {
    try {
        const { success, message } = await login(driver);
        if (!success) {
            return { success: false, message, data: false };
        }
        // await driver.handle.click('a[data-title="OpenClash"]');
        const openclashUrl = `${ROUTOR_DOMAIN}cgi-bin/luci/admin/services/openclash`
        await driver.page.open_single_full(openclashUrl);
        // await driver.content.waitForElement('body');
        return { success: true, message: "Openclash opened successfully", data: true };
    } catch (error) {
        return { success: false, message: `Failed to open Openclash: ${error}`, data: false };
    }
});
const openYacd = standardPuppeteerOperation(async function (driver) {
    try {
        const { success, message } = await login(driver);
        console.log(`openYacd`, success, message)
        if (!success) {
            return { success: false, message, data: false };
        }
        await openOpenclash();
        await driver.handle.clickWait('[onclick="return ycad_dashboard(this)"]');
        // await driver.page.waitForNavigation();
        await driver.handle.clickWait('[href="#/proxies"]');
        const proxyInfo = await getProxyData(driver);
        if(!proxyInfo.length){
            await driver.handle.clickWait('[title="Toggle collapsible section"]');
        }
        return { success: true, message: "Yacd opened successfully", data: true };
    } catch (error) {
        return { success: false, message: `Failed to open Yacd: ${error}`, data: false };
    }
});
const checkOpenYacd = standardPuppeteerOperation(async function (driver) {
    try {
        await driver.page.refresh();
        const tooltip_hidden = await driver.content.queryAllElements('[data-state="tooltip-hidden"]');
        if (tooltip_hidden) {
            return { success: true, message: "Already logged in OpenYacd", data: true };
        }
        return { success: false, message: "Not logged in OpenYacd", data: false };
    } catch (error) {
        return { success: false, message: `Error checking login-OpenYacd status: ${error}`, data: null };
    }
});
const getProxyInfo = standardPuppeteerOperation(async function (driver) {
    try {
        const { success: loginStatus } = await checkOpenYacd(driver);
        if (!loginStatus) {
            const { success, message } = await openYacd(driver);
            if (!success) {
                return { success: false, message, data: [] };
            }
        }
        await driver.handle.click('._btn_lzu00_1._circular_lzu00_27');
        await driver.content.waitForElement('._proxy_5mgcm_1._selectable_5mgcm_32');
        const proxyInfo = await getProxyData(driver);
        return {
            success: true,
            message: `Proxy info retrieved successfully, total wait time: ${proxyInfo.totalWaitTime} seconds.`,
            data: proxyInfo.proxyData
        };
    } catch (error) {
        return { success: false, message: `Failed to get proxy info: ${error}`, data: [] };
    }
});
async function getProxyData(driver) {
    return await driver.handle.executeJsCode(async () => {
        const proxies = document.querySelectorAll('._proxy_5mgcm_1._selectable_5mgcm_32');
        const proxyCount = proxies.length;
        const proxyData = [];

        for (let i = 0; i < proxyCount; i++) {
            const proxy = proxies[i];
            const latencyText = proxy.querySelector('._proxyLatency_pw0sa_1').textContent;
            const latency = parseFloat(latencyText.replace(/[^0-9]/g, '')) || 10000;

            proxyData.push({
                name: proxy.querySelector('._proxyName_5mgcm_57').textContent,
                type: proxy.querySelector('._proxyType_5mgcm_40').textContent,
                latency: latency
            });

            await new Promise(resolve => setTimeout(resolve, 500));
        }
        proxyData.sort((a, b) => a.latency - b.latency);
        proxyData.forEach(proxy => {
            if (proxy.latency === 10000) {
                proxy.latency = '';
            }
        });
        return { proxyData, totalWaitTime: proxyCount * 0.5 };
    });
}

module.exports = {
    closeExtraWindows,
    checkLoginStatus,
    login,
    openWebsite,
    openOpenclash,
    openYacd,
    getProxyInfo
};