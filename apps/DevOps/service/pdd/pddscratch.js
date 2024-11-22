'use strict';

const { Service } = require('@egg/ee-core');
const Addon = require('@egg/ee-core/addon');
const Services = require('@egg/ee-core/services');
let spider = null
let browsers = {}, emitSocket = null,productService

class PddscratchService extends Service {

  constructor(ctx) {
    super(ctx);
  }

  async init(emitSok) {
    emitSocket = emitSok
    if(!productService)productService = Services.get('product');await productService.init(emitSocket);
  }

  async closeBrowser(id) {
    const browserInstance = browsers[id];
    if (browserInstance && browserInstance.browser) {
      try {
        await browserInstance.browser.page.closeWindow();
      } catch (e) {
        console.log(`closeBrowser`);
        console.log(e);
      }
      delete browsers[id];
    }
  }

  async createOrGetBrowser(id, params = null,options={headless:false}) {
    console.log(`createOrGetBrowser`,id)
    let cookieData = {};
    if (params && params.cookieData) {
      cookieData = params.cookieData
    } else {
      cookieData.cookie = params;
    }

    if (!spider) spider = await Addon.get('spider');
    let instance = browsers[id];

    let createBrowser = true
    if (instance) {
      if (instance.browser) {
        const isConnected = await instance.browser.page.isConnected();
        if (isConnected) {
          createBrowser = false
        } else {
          try {
            await instance.browser.page.closeWindow();
          } catch (e) {
            console.log(`createOrGetBrowser-closeWindow`);
            console.log(e);
          }
        }
      }
    }
    if (createBrowser) {
      const browser = await spider.createBrowser(options);
      browsers[id] = {
        id: id,
        browser,
        setCookie: false,
        setLocalStorageData: false,
        setSessionStorageData: false,
      };
      await this.setBrowserData(browser, cookieData, browsers[id]);
    } else {
      console.log(`${id} browser already exists`)
    }
    return browsers[id].browser;
  }

  async setBrowserData(browser, cookieData, setTokenInstance = null) {
    if (cookieData.cookie &&
      (
        (setTokenInstance && !setTokenInstance.setCookie) ||
        !setTokenInstance
      )
    ) {
      try {
        // console.log(`setCookies`)
        // console.log(cookieData)
        await browser.page.setCookies(cookieData.cookie);
        if (setTokenInstance) setTokenInstance.setCookie = true;
      } catch (error) {
        console.error('Error setting cookies:', error);
      }
    }
    if (cookieData.localStorageData &&
      (
        (setTokenInstance && !setTokenInstance.setLocalStorageData) ||
        !setTokenInstance
      )
    ) {
      try {
        await browser.page.setLocalStorageData(cookieData.localStorageData);
        if (setTokenInstance) setTokenInstance.setLocalStorageData = true;
      } catch (error) {
        console.error('Error setting localStorageData:', (error+"").split(`at`)[0]);
      }
    }

    if (cookieData.sessionStorageData &&
      (
        (setTokenInstance && !setTokenInstance.setSessionStorageData) ||
        !setTokenInstance
      )
    ) {
      try {
        await browser.page.setSessionStorageData(cookieData.sessionStorageData);
        if (setTokenInstance) setTokenInstance.setSessionStorageData = true;
      } catch (error) {
        console.error('Error setting sessionStorageData:', error);
      }
    }
  }


  async getProductInformation(broser) {
    const { content } = broser;

    const imageSelector = '._1fBWnMAg';
    const imageElements = await content.getImgAttributesMatchingSelector(imageSelector);
    console.log(`imageElements`, imageElements)
    const imageAttributes = imageElements.map((element) => {
      const src = element.getAttribute('src');
      const alt = element.getAttribute('alt');
      return { src, alt };
    });

    const textSelector1 = '._15NyfC_w';
    const textElement1 = await content.getElementBySelector(textSelector1);
    const text1 = textElement1 ? textElement1.textContent : 'Text not found';

    const textSelector2 = '._1fdrZL9O';
    const textElement2 = await content.getElementBySelector(textSelector2);
    const text2 = textElement2 ? textElement2.textContent : 'Text not found';
    /*
    商品标题
    商品轮播图
    商品属性 {}
    商品视频(如果有)
    商品讲解视频(如果有)
    商详视频(如果有)
    商品详情:快捷编辑
    商品详情:商详装饰
    商品素材:白底图
    商品素材:长图
    规格与库存:{
      商品规格,
      价各及库存,
      商品参考价,
      满件折扣
    }
    服务与承诺{
      承诺发货时间,
      承诺,
      更多服务
    }


    */
    // 打印信息
    console.log('Images:', imageAttributes);
    console.log('Text 1:', text1);
    console.log('Text 2:', text2);
    return imageAttributes
  }

  async getShopDetail(params, inner = true) {
    params.cookieData = productService.getCookiesInner(params);
    const browser = await this.createOrGetBrowser(`commodityBroser`, params,{headless:true})
    let url
    if(!params.type){
      if(params.queryField.indexOf('http') !== -1){
        params.type = 'url'
      }else{
        params.type = 'id'
      }
    }
    if (params.type == 'id') {
      url = `https://mobile.yangkeduo.com/goods.html?goods_id=${params.queryField}`
    } else {
      url = params.queryField
    }
    const option = {
      only: inner ? true : false,
      urlStrict: inner ? false : true,
    }
    await browser.page.open(url, option)
    const currentUrl = await browser.page.getCurrentUrl()
    if (currentUrl.indexOf(`/login.html`) !== -1) {
      return {
        success: false,
        info: "获取商品Cookie已经过期"
      }
    } else {
      if (inner) {
        const fetch_shop_detail = async (url) => {
          const response = await fetch(url);
          if (!response.ok) {
            console.log(`HTTP error! status: ${response.status}`);
            return Promise.resolve(null)
          }
          const text = await response.text()

          const regex = /window\.rawData\s*=\s*(.*?)[\r\n]+/;
          const result = text.match(regex);
          let data = {}
          if (result && result[1]) {
            let extractedContent = result[1].trim();
            extractedContent = extractedContent.replace(/^;+|;+$/g, '');
            try {
              data = JSON.parse(extractedContent)
              // data = JSON.stringify(data)
            } catch (e) {
              console.log(e)
            }
            console.log(`data`, data)
          } else {
            console.error('Matching failed or no content found.');
          }
          return Promise.resolve(data)
        }

        const currentPage = await browser.page.getCurrentPage()
        const data = await currentPage.evaluate(fetch_shop_detail, url);
        if (data.store) {
          return data
        } else {
          return {
            success: false,
            info: "Failed to obtain,"
          }
        }
      } else {
        const rawData = await browser.handle.returnByJavascript('return window.rawData;');
        return rawData;
      }
    }

  }

  async continue_write(){
    return "返回数据:用户"
  }

  async getShopDetailInnerUlr(params) {
    const browser = await this.createOrGetBrowser(`commodityBroser`, params)
    let url
    if (params.type == 'id') {
      url = `https://mobile.yangkeduo.com/goods.html?goods_id=${params.queryField}`
    } else {
      url = params.queryField
    }
    const page = await browser.page.open(url, {
      only: false,
      urlStrict: true,
    })
    const getShopUrl = async () => {
      fetch('https://mobile.yangkeduo.com/goods.html?goods_id=508013555527&uin=HHID64GLF66KG6F4LZTF3QUGJU_GEXDA').then(async (data) => {
        const htmlText = await data.text()

      })
    }
    // const text = '...';  // 这里是你的文本内容
    // const regex = /window\.rawData\s*=\s*([\s\S]*?)\s*<\/script>/;
    // const result = text.match(regex);

    // if (result && result[1]) {
    //   const extractedContent = result[1].trim();  // 使用trim方法去掉两边的空格
    //   console.log(extractedContent);
    // } else {
    //   console.error('Matching failed or no content found.');
    // }
    const rawData = await browser.handle.returnByJavascript('return window.rawData;', page.index);
  }

}

PddscratchService.toString = () => '[class PddscratchService]';
module.exports = PddscratchService;  