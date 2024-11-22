'use strict';
const _ = require('lodash');
const { Controller } = require('@egg/ee-core');
const Services = require('@egg/ee-core/services');
const Socket = require('@egg/ee-core/socket');
const Addon = require('@egg/ee-core/addon');
const EE = require('@egg/ee-core/ee');
const Log = require('@egg/ee-core/log');

let productService,
  scratchService = null,
  cookiesService = null,
  backloadService = null, 
  collectingQueue = {},
  spiderUtil = null,
  socketServer
  ;
class ProductController extends Controller {
  constructor(ctx) {
    super(ctx);
    this.cookieIdentifyQueue = [];

  }

  async init() {
    if (!productService) {
      productService = Services.get('product');
      await productService.init(this.emitSocket)
    }
    if (!scratchService) {
      scratchService = Services.get('pddscratch');
      await scratchService.init(this.emitSocket)
    }
    if (!cookiesService) {
      cookiesService = Services.get('pddcookies');
      await cookiesService.init(this.emitSocket)
    }
    if (!backloadService) {
      backloadService = Services.get('pddbackload');
      await backloadService.init(this.emitSocket, collectingQueue)
    }
  }

  async emitSocket(method = null, params = null, callback = null, exclude = {}) {
    
// const Socket = require('@egg/ee-core/socket');
    if (!spiderUtil) {
      const spider = await Addon.get('spider');
      const { Util } = await spider.getUtil()
      spiderUtil = Util
    }
    if (!socketServer) {
      socketServer = Socket.getSocketServer();
    }
    // console.log(`emitSocket`, `method`, method, `params`, Object.keys(params))
    if (method) {
      if (!params) {
        params = method;
        method = null;
      }
      params = spiderUtil.json.toJSON(params, 10, 0, new Set(), exclude)
      let data = {
        method,
        params
      }
      // data = JSON.stringify(data)
      // console.log(params)
      socketServer.io.emit("client-listing", data);
    }
    else { console.log(`emit not found method ${method}`); }
    if (callback) callback()
  }

  async invokeServer(data, ...args) {
    await this.init()
    const {
      method,
      params
    } = data
    console.log("data",data)
    if (typeof params == 'string') {
      try {
        params = JSON.parse(params)
      } catch (e) {
        console.log(`invokeServer`, e)
      }
    }
    if (productService[method] && typeof productService[method] == 'function') {
      return productService[method](params, args);
    } else {
      return {
        error: new Error(`Method ${method} does not exist on productService`)
      }
    }
  }

  async getCookies(params) {
    await this.init()
    const addCookieTask = (task) => {
      this.cookieIdentifyQueue.push(task);
    }

    const closeLoginBroser = async (broserId) => {
      console.log(`closeLoginBroser`)
      await scratchService.closeBrowser(broserId)
    }

    const processCookieTasks = async () => {
      const broserId = `cookieBrowser`;
      while (this.cookieIdentifyQueue.length > 0) {
        const params = this.cookieIdentifyQueue.shift();
        console.log(`params`, params)
        try {
          const browser = await scratchService.createOrGetBrowser(broserId)
          await cookiesService._fetchCookies(params, browser);

        } catch (error) {
          console.error('Error processing task:', error);
        }
      }
      setTimeout(() => {
        closeLoginBroser(broserId)
      }, 12000)
    }
    addCookieTask(params);
    processCookieTasks();
    return { success: true, message: null, data: {} }; // 返回的数据结构可能需要更具实际情况调整
  }
  /*
  params = {
    type: 'url',
    queryField: 'https://mobile.yangkeduo.com/goods.html?goods_id=486833901714',
    cookieOwer: 'Admin'
  }
  */

  async httpShopDetail() {
    const Base_authorization = "508013555527"
    const { CoreApp } = EE;
    const method = CoreApp.request.method;
    let params = CoreApp.request.query;
    params = (params instanceof Object) ? params : JSON.parse(JSON.stringify(params));
    const body = CoreApp.request.body;

    const authorization = body.authorization || params.authorization;
    const queryField = body.queryField || params.queryField;
    const cookieOwer = `Admin`;

    if (!authorization) {
      return {
        error: '需要授权ID'
      };
    }
    if ( Base_authorization != authorization) {
      return {
        error: '授权ID不正确'
      };
    }
    if (!queryField) {
      return {
        error: '需要商品queryField,或者商品连接.'
      };
    }
    const result = await this.getShopDetail({
      queryField,
      cookieOwer
    });
    return result;
  }

  async getShopDetail(params) {
    await this.init()
    console.log(`getShopDetail`) 
    console.log(params)
    const data = await scratchService.getShopDetail(params);
    return {
      success: false,
      message: 'Api Info as',
      data
    };
  }

  async toCellecting(params) {
    await this.init()
    return await backloadService.toCellecting(params)
  }

  async processQueue() {
    await this.init()
    return await backloadService.processQueue()
  }

  async controlDataFetching(params) {
    await this.init()
    const vertex = 10;
    const {
      state,
    } = params
    /**
     * 
     *this.pdd.cookie = data.pdd.cookie;
      this.pdd.isLogin = data.pdd.isLogin;
      this.pdd.localStorageData = data.pdd.localStorageData;
      this.pdd.sessionStorageData = data.pdd.sessionStorageData;
      this.pdd.indexedDBData = data.pdd.indexedDBData;
     */
    // return
    const scratchServiceName = `pddscratch`, broserId = `commodityBroser`
    try {
      if (state) {
        const cookieData = params.cookie
        const {
          cookie,
          localStorageData,
          sessionStorageData,
        } = cookieData
        console.log(`cookie`, cookie)
        console.log(`localStorageData`, localStorageData)
        console.log(`sessionStorageData`, sessionStorageData)
        const noCollectionData = productService.getProductCategoriesByNoCollection(10)
        const noCollection = noCollectionData.data
        // console.log(noCollection)
        console.log(`noCollection`, noCollection.length)
        while (noCollection.length) {
          const products = noCollection.shift()
          while (products.length) {
            const product = products.shift()
            const url = product.url
            const id = product.id
            const collection = product.collection
            const browser = await Services.get(scratchServiceName).createOrGetBrowser(broserId, cookie, sessionStorageData, localStorageData)
            await browser.page.open(url, { only: false })
            await Services.get(scratchServiceName).getProductInformation(browser)
            break
          }
          break
        }
      }
      return { success: true, message: null, isFetchingData: state };
    } catch (error) {
      console.error('Error during data fetching control:', error);
      return { success: false, message: error, isFetchingData: null };
    }
  }

  async scratch_pdd() {
    await this.init()

  }
}

ProductController.toString = () => '[class ProductController]';
module.exports = ProductController;
