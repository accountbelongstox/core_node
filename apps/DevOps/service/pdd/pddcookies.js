'use strict';

const { Service } = require('@egg/ee-core');
let cookieData = {},emitSocket=null

class PddcookiesService extends Service {

    constructor(ctx) {
        super(ctx);
    }

    async init(emitSok) {
        emitSocket = emitSok
    }

    async _fetchCookies(params, browser) {
        return new Promise(async (resolve, reject) => {
            const {
                loginUrl,
                username,
                identifyType = "productLogin",//productLogin  || cookiesShop
                password,
                cookieOwer,
            } = params;
            if (!cookieData[cookieOwer]) {
                cookieData[cookieOwer] = {
                    cookie: null,
                    isLogin: null,
                    localStorageData: null,
                    sessionStorageData: null,
                    indexedDBData: null,
                    cookieOwer,
                    identifyType,
                };
            }
            let getCookieEvent = null;
            try {
                cookieData[cookieOwer].isLogin = false;
                switch (identifyType) {
                    case "productLogin":
                        await this.productLogin(browser, params, cookieData, getCookieEvent, resolve)
                    case "cookiesShop":
                        await this.cookiesShop(browser, params, cookieData, getCookieEvent, resolve)
                }
            } catch (error) {
                console.error('Error during _fetchCookies:', error);
                if (getCookieEvent) clearInterval(getCookieEvent);
                resolve(cookieData[cookieOwer]);
            }
        });
    }

    async cookiesShop(browser, params, cookieData, getCookieEvent, resolve) {
        const {
            loginUrl,
            username,
            identifyType = "cookiesShop",
            password,
            cookieOwer,
            verifyCode = null,
        } = params;
        if (!verifyCode) {
            cookieData[cookieOwer].writeAccount = undefined
            cookieData[cookieOwer].clickLogint = undefined
            cookieData[cookieOwer].clickVerifyButton = undefined
            await browser.page.closeNonBlankPages();
            await browser.page.open(loginUrl);
            if (getCookieEvent) clearInterval(getCookieEvent);
            getCookieEvent = null
        } else {
            cookieData[cookieOwer].verifyCode = verifyCode
        }
        const emitEventName = identifyType + 'Push'
        getCookieEvent = setInterval(async () => {
            console.log(`emitEventName`, emitEventName)
            try {
                // const loginElement = await browser.content.getElementByText('.tab-operate tab-item');
                // const loginElement = await browser.content.getElementByText('账号登录');
                if (cookieData[cookieOwer].writeAccount === undefined) {
                    cookieData[cookieOwer].writeAccount = null
                    console.log(`browser`, !!browser)
                    await browser.handle.clickElementByContent('账号登录');
                    await browser.handle.clearInputBySelector('#usernameId');
                    await browser.handle.clearInputBySelector('#passwordId');
                    await browser.handle.setInputBySelector('#usernameId', username);
                    await browser.handle.setInputBySelector('#passwordId', password);
                    console.log(`password done`)
                    cookieData[cookieOwer].writeAccount = true
                }
                if (cookieData[cookieOwer].writeAccount = true && cookieData[cookieOwer].clickLogint === undefined) {
                    cookieData[cookieOwer].clickLogint = null
                    setTimeout(async () => {
                        await browser.handle.clickElementBySelector(`[data-testid="beast-core-button"]`);
                        cookieData[cookieOwer].clickLogint = true
                        if (cookieData[cookieOwer].clickVerifyButton === undefined) {
                            cookieData[cookieOwer].clickVerifyButton = null
                            setTimeout(async () => {
                                await browser.handle.clickElementBySelector(`[data-testid="beast-core-button-link"]`);
                                cookieData[cookieOwer].clickVerifyButton = true
                            }, this.generateRandom(200, 1000))
                        }
                    }, this.generateRandom(200, 1000))
                }
                if (cookieData[cookieOwer].verifyCode) {
                    await browser.handle.setInputBySelector('[placeholder="请输入短信验证码"]', cookieData[cookieOwer].verifyCode);
                    await browser.handle.clickElementBySelector(`[data-testid="beast-core-button"]`);
                }
                const currentUrl = await browser.page.getCurrentUrl();
                if (this._isLoggedType(identifyType, currentUrl)) {
                    setTimeout(async () => {
                        cookieData[cookieOwer].isLogin = true;
                        cookieData[cookieOwer].cookie = await browser.page.getCookies();
                        try {
                            cookieData[cookieOwer].localStorageData = await browser.page.getLocalStorageData();
                        } catch (error) {
                            console.error(`error`);
                            console.error(error);
                        }
                        try {
                            cookieData[cookieOwer].sessionStorageData = await browser.page.getSessionStorageData();
                        } catch (error) {
                            console.error(`error`);
                            console.error(error);
                        }
                        emitSocket(emitEventName, {
                            cookieOwer,
                            data: cookieData[cookieOwer]
                        }, () => {
                            resolve(cookieData[cookieOwer]);
                            setTimeout(() => {
                                cookieData[cookieOwer] = null
                            }, 1000)
                        });
                        if (getCookieEvent) clearInterval(getCookieEvent);
                        getCookieEvent = null
                    }, 1000)
                } else {
                    emitSocket(emitEventName, {
                        cookieOwer,
                        data: cookieData[cookieOwer]
                    });
                }
            } catch (error) {
                console.error(`error`);
                console.error(error);
                emitSocket(identifyType, {
                    cookieOwer,
                    data: cookieData[cookieOwer]
                }, () => {
                    resolve(cookieData[cookieOwer]);
                    if (getCookieEvent) clearInterval(getCookieEvent);
                    getCookieEvent = null
                });
            }
        }, 2000);
    }

    async productLogin(browser, params, cookieData, getCookieEvent, resolve) {
        const {
            loginUrl,
            username,
            identifyType = "productLogin",//productLogin  || cookiesShop
            password,
            cookieOwer,
        } = params;

        await browser.page.closeNonBlankPages();
        await browser.page.open(loginUrl);
        getCookieEvent = setInterval(async () => {
            try {
                const currentUrl = await browser.page.getCurrentUrl();
                console.log(`cookieData[cookieOwer]`, cookieData[cookieOwer])
                console.log(`identifyType`, identifyType)
                console.log(`currentUrl`, currentUrl)
                console.log(`isLogin`, this._isLoggedType(identifyType, currentUrl))
                if (this._isLoggedType(identifyType, currentUrl)) {
                    clearInterval(getCookieEvent);
                    getCookieEvent = null
                    setTimeout(async () => {
                        cookieData[cookieOwer].isLogin = true;
                        cookieData[cookieOwer].cookie = await browser.page.getCookies();
                        try {
                            cookieData[cookieOwer].localStorageData = await browser.page.getLocalStorageData();
                        } catch (error) {
                            console.error(`error`);
                            console.error(error);
                        }
                        try {
                            cookieData[cookieOwer].sessionStorageData = await browser.page.getSessionStorageData();
                        } catch (error) {
                            console.error(`error`);
                            console.error(error);
                        }
                        emitSocket(identifyType, {
                            cookieOwer,
                            data: cookieData[cookieOwer]
                        }, () => {
                            resolve(cookieData[cookieOwer]);
                            setTimeout(() => {
                                cookieData[cookieOwer] = null
                            }, 1000)
                        });
                    }, 1000)
                }
            } catch (error) {
                console.error(`error`);
                console.error(error);
                emitSocket(identifyType, {
                    cookieOwer,
                    data: cookieData[cookieOwer]
                }, () => {
                    if (getCookieEvent) clearInterval(getCookieEvent);
                    resolve(cookieData[cookieOwer]);
                });
            }
        }, 1000);
    }

    _isLoggedType(identifyType, url) {
        switch (identifyType) {
            case 'productLogin':
                return !url.includes('login.html');
            case 'cookiesShop':
                return url.includes('/home');
            default:
                return false;
        }
    }

    generateRandom(x, y) {
        return Math.floor(Math.random() * (y - x + 1) + x);
    }

}

PddcookiesService.toString = () => '[class PddcookiesService]';
module.exports = PddcookiesService;  