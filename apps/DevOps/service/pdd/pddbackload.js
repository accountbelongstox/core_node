'use strict';
const { Service } = require('@egg/ee-core');
const Addon = require('@egg/ee-core/addon');
const Services = require('@egg/ee-core/services');
let productService
let collectingQueue = {}, intervalEmit = false, intervalEmitEvent = null,
    intervalEmitEventCount = 0,
    emitSocket,
    scratchService = null
    ;

class PddbackloadService extends Service {
    loginURL = 'https://mms.pinduoduo.com/login';
    loginEmitName = 'login-event'
    loadingEmitName = 'loading-status'
    intervalEmit = false

    constructor(ctx) {
        super(ctx);
    }

    async init(emitSok, collecting) {
        emitSocket = emitSok
        collectingQueue = collecting
        if (!scratchService) {
            scratchService = Services.get('pddscratch');
            await scratchService.init(emitSocket)
        }
        if (!productService) {
            productService = Services.get('product');
            await productService.init(emitSocket);
        }
    }

    productExistsInQueue(id) {
        return !!collectingQueue[id];
    }

    excludeShop(obj, exclude, reset) {
        if (!exclude) exclude = {
            'tempEvent': true,
            'timeoutEvent': true,
            'cookieEvent': true,
            'activeBrowser': true,
            'browser': {
                value: true
            },

        }
        let result = Array.isArray(obj) ? [] : {};
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                let value = obj[key];
                if (exclude[key] != undefined) {
                    if (exclude[key].value != undefined) {
                        result[key] = exclude[key].value;
                    }
                    continue;
                }
                if (typeof value === 'function') {
                    continue;
                }
                result[key] = value;
            }
        }
        if (reset) {
            if (result.hasOwnProperty('needVerifyCode')) {
                result['needVerifyCode'] = false
            }
            if (result.hasOwnProperty('verifyCode')) {
                result['verifyCode'] = ''
            }
            if (result.hasOwnProperty('statusText')) {
                result['statusText'] = ''
            }
        }
        return result;
    }

    async toCellecting(params) {
        const { id, isCollecting, verifyCode } = params;
        if (isCollecting) {
            if (verifyCode && collectingQueue[id]) {
                collectingQueue[id]['verifyCode'] = verifyCode
            } else {
                if (params.createBrowserring) params.createBrowserring = undefined
                collectingQueue[id] = params;
            }
        } else {
            if (collectingQueue[id]) {
                this.closeBroserIfExist(collectingQueue[id])
                delete collectingQueue[id]
            }
        }
        const state = this.productExistsInQueue(id);
        this.processQueue()
        let data = { ...params }
        data = this.excludeShop(data, null, true)
        productService.updateShop({
            id: params.id,
            data,
        })
        return { success: true, message: null, data: { state } };
    }

    async isConnected(product) {
        if (product.browser) {
            if (product.browser.page && product.browser.page.isConnected) {
                try {
                    const isConnected = await product.browser.page.isConnected();
                    if (isConnected) {
                        return true
                    }
                } catch (e) {
                    console.log(e)
                }
            }
        }
        return false
    }

    async closeBroserIfExist(product) {
        if (product.browser) {
            if (product.browser.page && product.browser.page.close) {
                try {
                    await product.browser.page.closeWindow();
                } catch (err) {
                    console.log(err);
                }
            }
            product.browser = null
        }
    }

    async processQueue() {
        if (!intervalEmit) {
            intervalEmit = true;
            if (!Object.keys(collectingQueue).length) {
                //TODO
                // const allShopsData = await productService.getShops()
                //TODO
                // if (allShopsData && allShopsData.data) {
                //     const allShops = allShopsData.data
                //     allShops.map(item => {
                //         if (item.isCollecting === undefined) item.isCollecting = true;
                //         collectingQueue[item.id] = item
                //     })
                // }
                //TODO
            }
            if (!intervalEmitEvent) {
                intervalEmitEventCount++
                const exclude = {
                    'tempEvent': true,
                    'timeoutEvent': true,
                    'cookieEvent': true,
                    'browser': {
                        value: true
                    },
                    'verifyCode': true,
                }
                intervalEmitEvent = setInterval(() => {
                    emitSocket(this.loadingEmitName, {
                        data: collectingQueue
                    }, null, exclude);
                }, 1000)
            }
        }
        let spider;
        for (const key of Object.keys(collectingQueue)) {//此处 collectingQueue 为JSON,请修正
            const product = collectingQueue[key]
            const { cookieData, id, isCollecting } = product;
            if (isCollecting) {
                if (!spider) {
                    spider = await Addon.get('spider');
                }
                if (product.createBrowserring) {
                    console.log(`createBrowserring,wait.`)
                    return
                }
                let isActiveBrowser = false
                let isConnected = await this.isConnected(product)
                console.log(`isConnected`, isConnected)
                if (isConnected === true) {
                    isActiveBrowser = true
                } else {
                    await this.closeBroserIfExist(product)
                }
                if (!isActiveBrowser) {
                    console.log(`processQueue-createBrowserring`)
                    this.resetProductOne(product, `创建进程`)
                    product.createBrowserring = true;
                    product.tempEvent = {};

                    product.browser = await spider.createBrowser();
                    if (!product.tempEvent.createBrowserEvent) {
                        setTimeout(() => {
                            product.createBrowserring = false
                        }, 2000)
                    }
                }
                if (!cookieData || !cookieData.cookie) {
                    product.loginStatus = null
                    // emitSocket(this.loginEmitName, product);
                    this.fetchCookie(product, (status) => {
                        if (status) {
                            this.performShipping(product);
                        } else {
                            console.log(`fetchCookie found ${status}`)
                        }
                    });
                } else {
                    await product.browser.page.setCookies(cookieData.cookie);
                    await product.browser.page.open(this.loginURL);
                    setTimeout(async () => {
                        const currentURL = await product.browser.page.getCurrentUrl();
                        // console.log(`currentURL`, currentURL)
                        // console.log(`loginURL`, this.loginURL)
                        if (product.browser.util.url.equalDomainFull(currentURL, this.loginURL)) {
                            product.loginStatus = null
                            product.statusText = '登陆中..'
                            product.loginText = 'The current account login cookie has expired, please wait to obtain the cookie again..'
                            // emitSocket(this.loginEmitName, product);
                            this.fetchCookie(product, (status) => {
                                if (status) {

                                    this.performShipping(product);
                                } else {
                                    console.log(`fetchCookie found ${status}`)
                                }
                            });
                        } else {
                            product.loginStatus = true
                            product.statusText = '已登陆..'
                            product.loginText = 'The current account has been logged in successfully, please wait for the backend to load the goods.'
                            this.performShipping(product);
                        }
                    }, 2000);
                }
            } else {
                this.closeBroserIfExist(collectingQueue[id])
                collectingQueue[id].browser = null;
                delete collectingQueue[id];
            }
        }
        // emitSocket(this.loadingEmitName, collectingQueue);
    }

    resetProductOne(product, statusText) {
        product.pendingFetchCookie = false;
        product.loginStatus = false;
        product.writeAccount = undefined;
        product.clickLogint = undefined;
        product.clickVerifyButton = undefined;
        product.needVerifyCode = false;
        product.verifyCode = '';
        product.hasTimedOut = true;
        if (product.tempEvent) {
            if (product.tempEvent.timeoutEvent) {
                clearTimeout(product.tempEvent.timeoutEvent)
            }
            product.tempEvent = null;
        }
        if (product.cookieEvent) {
            clearInterval(product.cookieEvent);
            product.cookieEvent = null
        }
        product.statusText = statusText !== undefined ? statusText : '进程结束..'
    }

    async fetchCookie(product, callback) {
        const { browser } = product
        if (product.pendingFetchCookie) {
            product.statusText = '进程存在'
            console.log(`fetchCookie exists`)
            return;
        }
        if (product.tempEvent) {
            product.tempEvent = {}
        }
        console.log(`fetchCookie`)
        console.log(`verifyCode`, product.verifyCode)
        product.pendingFetchCookie = true
        product.hasTimedOut = false
        product.statusText = '获取Cookie'
        product.loginText = 'The current account does not have cookies, waiting to obtain the login cookie.'
        if (!product.verifyCode &&
            product.writeAccount === undefined &&
            product.clickLogint === undefined &&
            product.clickVerifyButton === undefined) {
            let currentURL = await browser.page.getCurrentUrl();
            console.log(`currentURL`, currentURL, typeof currentURL)
            console.log(`this.loginURL`, this.loginURL)
            product.statusText = '等待Cookie'
            if (!product.browser.util.url.equalDomainFull(currentURL, this.loginURL)) {
                await browser.page.closeNonBlankPages();
                await browser.page.open(this.loginURL);
            }

            if (!product.tempEvent.timeoutEvent) {
                let timeoutDuration = 60 * 3000;
                product.tempEvent.timeoutEvent = setTimeout(() => {
                    if (product) {
                        this.resetProductOne(product, '已超时..')
                    }
                }, timeoutDuration);
            }
            if (product.cookieEvent) {
                console.log(`product.cookieEvent already exists`)
                return;
            }
            product.cookieEvent = setInterval(async () => {
                product.statusText = '验证中...'
                if (product.hasTimedOut) {
                    product.statusText = '已超时...'
                    return;
                }

                if (product.pendingCookie) {//提取cookie中跳过
                    product.statusText = '等待Cookie提取...'
                    return;
                }
                if (product.pendingLogin) {//登陆过程中跳过
                    product.statusText = '等待登陆...'
                    return;
                }
                if (product.writeAccount === undefined) {//第一流程：先输入账号
                    product.writeAccount = null
                    if (!product.tempEvent.writeEvent) {
                        product.tempEvent.writeEvent = setTimeout(async () => {
                            await this.writeAccountProcess(browser, product)
                        }, browser.util.date.randomMillisecond(500, 1500));
                    }
                }

                if (browser.page.isBackUrl()) {
                    product.statusText = '载入中...'
                }

                if (product.writeAccount === true) {
                    if (product.clickLogint === undefined) {//第一流程：点击登陆
                        product.clickLogint = null
                        if (!product.tempEvent.clickLogintEvent) {
                            product.tempEvent.clickLogintEvent = setTimeout(async () => {
                                await this.clickLoginProcess(browser, product)
                            }, browser.util.date.randomMillisecond(500, 1500));
                        }
                    }
                }

                if (product.clickLogint === true) {
                    if (product.clickVerifyButton === undefined) {//第一流程：点击验证码获取按钮
                        product.clickVerifyButton = null
                        if (!product.tempEvent.clickVerifyButtonEvent) {
                            product.tempEvent.clickVerifyButtonEvent = setTimeout(async () => {
                                await this.clickVerifyProcess(browser, product)
                            }, browser.util.date.randomMillisecond(500, 1500));
                        }
                    }
                }
                if (
                    product.writeAccount &&
                    product.clickLogint &&
                    product.clickVerifyButton) {
                    if (product.needVerifyCode) {
                        if (!product.verifyCode) {//向客户端传送需要验证码
                            product.statusText = '提交验证码...'
                            // emitSocket(this.loginEmitName, product);
                        } else {
                            await this.verifyCodeProcess(browser, product);//得到验证码后验证
                        }
                    } else {
                        currentURL = await browser.page.getCurrentUrl();
                        if (!browser.util.url.equalDomainFull(currentURL, this.loginURL)) {
                            await this.extractCookie(browser, product, callback);
                            console.log(`Direct login situation`)
                        } else {
                            let text = await this.getInfoErrorText(browser)
                            if (!text) text = '未跳转..'
                            if (text.indexOf('错误') !== -1) {
                                product.statusText = '重新提交...'
                                product.needVerifyCode = true
                            }
                            product.loginStatus = false
                            product.statusText = text
                            product.loginText = 'Verification code has been issued, but the page does not jump.'
                            // emitSocket(this.loginEmitName, product);
                        }
                    }
                } else {
                    // console.log(`Login process`)
                    currentURL = await browser.page.getCurrentUrl();
                    // console.log(`Login getCurrentUrl`)
                    if (!browser.util.url.equalDomainFull(currentURL, this.loginURL)) {
                        await this.extractCookie(browser, product, callback);
                    }
                }


            }, 1000);
        } else {
            product.statusText = '等待中...'
        }
    }

    async getInfoErrorText(browser) {
        return await browser.content.getTextBySelector(`.info-error-text`)
    }

    async writeAccountProcess(browser, product) {
        await browser.handle.clickElementByContent('账号登录');
        await browser.handle.setInputBySelector('#usernameId', product.account);
        await browser.handle.setInputBySelector('#passwordId', product.password);
        setTimeout(async () => {
            product.writeAccount = true;
        }, browser.util.date.randomMillisecond(1000, 2000));
    }

    async clickLoginProcess(browser, product) {
        await browser.handle.clickElementBySelector(`[data-testid="beast-core-button"]`);
        setTimeout(async () => {
            product.clickLogint = true;
        }, browser.util.date.randomMillisecond(1000, 2000));
    }

    async clickVerifyProcess(browser, product) {
        const verifing = await browser.content.doesElementExist(`input[placeholder="请输入短信验证码"]`);
        if (verifing) {
            product.clickVerifyButton = true
        } else {
            const verifyButton = `[data-testid="beast-core-button-link"]`
            const verifyButtonExists = await browser.content.doesElementExist(verifyButton);
            if (verifyButtonExists) {
                await browser.handle.clickElementBySelector(verifyButton);
            }
        }
        setTimeout(async () => {
            const currentURL = await browser.page.getCurrentUrl();
            if (browser.util.url.equalDomainFull(currentURL, this.loginURL)) {
                product.needVerifyCode = true
                product.verifyCode = ''
            }
            product.clickVerifyButton = true;
        }, browser.util.date.randomMillisecond(1000, 2000));
    }

    async verifyCodeProcess(browser, product) {
        product.pendingLogin = true
        product.needVerifyCode = false
        product.statusText = `校验中...`
        await browser.handle.setInputBySelector('[placeholder="请输入短信验证码"]', product.verifyCode);
        await browser.handle.clickElementBySelector(`[data-testid="beast-core-button"]`);
        setTimeout(async () => {
            product.pendingLogin = false
        }, 2000);
    }

    async extractCookie(browser, product, callback) {
        product.pendingCookie = true
        product.cookieData = {}
        product.needVerifyCode = false
        try {
            product.cookieData.cookie = await browser.page.getCookies();
        } catch (e) {
            console.log(`extractCookie-cookie`)
            console.log(e)
            product.cookieData.cookie = null;
        }

        try {
            product.cookieData.localStorageData = await browser.page.getLocalStorageData();
        } catch (e) {
            console.log(`extractCookie-localStorageData`)
            console.log(e)
            product.cookieData.localStorageData = null;
        }

        try {
            product.cookieData.sessionStorageData = await browser.page.getSessionStorageData();
        } catch (e) {
            console.log(`extractCookie-sessionStorageData`)
            console.log(e)
            product.cookieData.sessionStorageData = null;
        }

        product.pendingCookie = false
        let status = false
        if (product.cookieData.cookie) {
            // productService.updateShop
            status = true
            product.loginStatus = true
            product.statusText = '已成功..'
            product.loginText = 'Log in and obtain cookies successfully.'
            const id = product.id
            productService.updateShop(
                {
                    id,
                    product,
                }
            )
        } else {
            product.loginStatus = false
            product.statusText = '成功(未获取cookie)..'
            product.loginText = 'Failed to extract cookies after logging in.'
        }
        if (product.cookieEvent) {
            clearInterval(product.cookieEvent);
            product.cookieEvent = null
        }
        if (callback) callback(status)
        // emitSocket(this.loginEmitName, product);
    }
    async performShipping(product) {
        const { browser, id } = product;
        const shopUrlsResponse = await productService.queryBindShopUrls({ id });
        if (!shopUrlsResponse.success) {
            console.error("Failed to retrieve shop URLs:", shopUrlsResponse.message);
            return;
        }
        const shopUrls = shopUrlsResponse.data.bindShopUrls;
        const processUrls = async (urls) => {
            let stopDebug = false
            if (!urls || urls.length === 0) {
                return;
            }
            const url = urls.shift();
            const params = {
                type: "url",
                queryField: url,
                cookieOwer: 'Admin'
            };
            const shopDetailResponse = await scratchService.getShopDetail(params);
            if (!shopDetailResponse || !shopDetailResponse.success === false) {
                product.getShopDetailStatus = false;
                product.statusText = shopDetailResponse.info;
                product.retrieveText = "Failed to retrieve shop details for URL:" + url;
                console.error("Failed to retrieve shop details for URL:", url);
                return;
            } else if (shopDetailResponse && shopDetailResponse.store && shopDetailResponse.store.initDataObj) {
                const initDataObj = shopDetailResponse.store.initDataObj
                const goods = initDataObj.goods
                const goodsName = goods.goodsName
                if (goodsName) {
                    stopDebug = true
                    await this.fillInProductInformation(product, shopDetailResponse)
                } else {
                    console.log(`Product title not obtained, skip`)
                }
            } else {
                product.getShopDetailStatus = false;
                product.statusText = shopDetailResponse.info;
                product.retrieveText = "Store and initDataObj were not obtained:" + url;
                console.error("Store and initDataObj were not obtained:", url);
            }
            if (!stopDebug) {
                await processUrls(urls);
            }
        };
        await processUrls(shopUrls);
    }

    async fillInProductInformation(product, shopDetailResponse) {
        const { browser, id } = product;
        try {
            const initDataObj = shopDetailResponse.store.initDataObj
            const goods = initDataObj.goods
            // console.log(`goods`)
            // console.log(goods)
            const goodsName = goods.goodsName
            if (goodsName) {
                const shareDesc = goods.shareDesc
                const topGallery = goods.topGallery  //需要下载 [{url,id,aspectRatio}]
                const viewImageData = goods.viewImageData //需要下载 [url]
                const detailGallery = goods.detailGallery //需要下载 [{url,width,height}]
                const videoGallery = goods.videoGallery //需要下载 [{url,width,height,videoUrl}]
                const skus = goods.skus //[]
                const thumbUrl = goods.thumbUrl
                const hdThumbUrl = goods.hdThumbUrl
                const quickRefund = goods.quickRefund
                const maxNormalPrice = goods.maxNormalPrice
                const minNormalPrice = goods.minNormalPrice
                const maxGroupPrice = goods.maxGroupPrice
                const minGroupPrice = goods.minGroupPrice
                const minOnSaleGroupPrice = goods.minOnSaleGroupPrice
                const maxOnSaleGroupPriceInCent = goods.maxOnSaleGroupPriceInCent
                const minOnSaleGroupPriceInCent = goods.minOnSaleGroupPriceInCent
                const maxOnSaleNormalPrice = goods.maxOnSaleNormalPrice
                const minOnSaleNormalPrice = goods.minOnSaleNormalPrice
                const unselectNormalSavePrice = goods.unselectNormalSavePrice
                const oldMinOnSaleGroupPriceInCent = goods.oldMinOnSaleGroupPriceInCent
                const goodsProperty = goods.goodsProperty //[{ 
                //     "key":"品牌",
                //     "values":[
                //         "Warrior/回力"
                //     ],
                //     "ref_pid":310,
                //     "reference_id":886
                // }]
                await browser.screen.moveMouseRandomCurve();
                const hasPathname = await browser.page.hasPathname("/goods/category");
                if (hasPathname === false) {
                    await browser.handle.executeJsCode(() => {
                        window.location.href = window.location.origin + '/goods/category'
                    });
                }

                setTimeout(async () => {
                    const searchInputSelector = 'input[data-testid="beast-core-input-htmlInput"]';
                    browser.content.waitForCallback(searchInputSelector, async () => {
                        console.log("waitForElement success");
                        console.log(`searchInputSelector ${searchInputSelector}`);
                        console.log(`goodsName ${goodsName}`);
                        await browser.handle.setInputBySelector(searchInputSelector, goodsName);
                        const searchButtonSelector = `.SPP_searchItem_5-87-0`
                        await browser.content.waitForElement(searchButtonSelector)
                        await browser.handle.clickElementBySelector(searchButtonSelector);
                        setTimeout(async () => {
                            const confirmButtonSelector = 'button[data-e2e-id="e2e-publish-button"]';
                            await browser.content.waitForElement(confirmButtonSelector)
                            console.log("waitForElement" + confirmButtonSelector);
                            await browser.handle.clickElementBySelector(confirmButtonSelector);
                            const acknowledgeButtonSelector = 'button[data-volta="c96ab44b-2a3b-43bb-8839-3878cfe2d609"]';
                            browser.content.waitForCallback(acknowledgeButtonSelector, async () => {
                                console.log("acknowledgeButtonSelector" + acknowledgeButtonSelector);
                                const acknowledgeButton = await browser.handle.clickElementBySelector(acknowledgeButtonSelector);
                            })
                        }, 2000)
                    })
                }, 2000)
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }
}

PddbackloadService.toString = () => '[class PddbackloadService]';
module.exports = PddbackloadService;  