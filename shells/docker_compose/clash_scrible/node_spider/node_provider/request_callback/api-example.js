
const ipcApiRoute = {
    test: 'controller.example.test',
    checkForUpdater: 'controller.framework.checkForUpdater',
    downloadApp: 'controller.framework.downloadApp',
    jsondbOperation: 'controller.framework.jsondbOperation',
    sqlitedbOperation: 'controller.framework.sqlitedbOperation',
    uploadFile: 'controller.framework.uploadFile',
    checkHttpServer: 'controller.framework.checkHttpServer',
    doHttpRequest: 'controller.framework.doHttpRequest',
    doSocketRequest: 'controller.framework.doSocketRequest',
    ipcInvokeMsg: 'controller.framework.ipcInvokeMsg',
    ipcSendSyncMsg: 'controller.framework.ipcSendSyncMsg',
    ipcSendMsg: 'controller.framework.ipcSendMsg',
    startJavaServer: 'controller.framework.startJavaServer',
    closeJavaServer: 'controller.framework.closeJavaServer',
    someJob: 'controller.framework.someJob',
    timerJobProgress: 'controller.framework.timerJobProgress',
    createPool: 'controller.framework.createPool',
    createPoolNotice: 'controller.framework.createPoolNotice',
    someJobByPool: 'controller.framework.someJobByPool',
    hello: 'controller.framework.hello',
    openSoftware: 'controller.framework.openSoftware',
  
    messageShow: 'controller.os.messageShow',
    messageShowConfirm: 'controller.os.messageShowConfirm',
    selectFolder: 'controller.os.selectFolder',
    selectPic: 'controller.os.selectPic',
    openDirectory: 'controller.os.openDirectory',
    loadViewContent: 'controller.os.loadViewContent',
    removeViewContent: 'controller.os.removeViewContent',
    createWindow: 'controller.os.createWindow',
    getWCid: 'controller.os.getWCid',
    sendNotification: 'controller.os.sendNotification',
    initPowerMonitor: 'controller.os.initPowerMonitor',
    getScreen: 'controller.os.getScreen',
    autoLaunch: 'controller.os.autoLaunch',
    setTheme: 'controller.os.setTheme',
    getTheme: 'controller.os.getTheme',
    puppeteer: 'controller.puppeteer.test',
    test2: 'controller.shopping.addShopType',
    storagedb: 'controller.shopping.addShopType',
    getPrinterList: 'controller.hardware.getPrinterList',
    print: 'controller.hardware.print',
    printStatus: 'controller.hardware.printStatus',
  
    getText: 'controller.text.getText',
    textButton: 'controller.text.textButton',
    textStatus: 'controller.text.textStatus',
  
    selectFile: 'controller.effect.selectFile',
    loginWindow: 'controller.effect.loginWindow',
    restoreWindow: 'controller.effect.restoreWindow',
  
    createDatabase: 'controller.product.createDatabase',
    validateShopParams: 'controller.product.validateShopParams',
    addShop: 'controller.product.addShop',
    addProductCategory: 'controller.product.addProductCategory',
    deleteProductCategory: 'controller.product.deleteProductCategory',
    addProductList: 'controller.product.addProductList',
    deleteShopById: 'controller.product.deleteShopById',
    updateProductShelf: 'controller.product.updateProductShelf',
    updateShopAttributes: 'controller.product.updateShopAttributes',
    authenticatePermission: 'controller.product.authenticatePermission',
    addAdministrator: 'controller.product.addAdministrator',
    loginAuthentication: 'controller.product.loginAuthentication',
    updatePassword: 'controller.product.updatePassword',
    updateSettings: 'controller.product.updateSettings',
    getProductCategories: 'controller.product.getProductCategories',
    getProductListsByCategory: 'controller.product.getProductListsByCategory',
    getAvailableProductLists: 'controller.product.getAvailableProductLists',
    controlDataFetching: 'controller.product.controlDataFetching',
    controlAllUsersAutoStocking: 'controller.product.controlAllUsersAutoStocking',
    startAutoProductListing: 'controller.product.startAutoProductListing',
    getShops: 'controller.product.getShops',
    getShop: 'controller.product.getShop',
    getCookies: "controller.product.getCookies",
    setCookies: "controller.product.setCookies",
    toCellecting: "controller.product.toCellecting",
    getShopDetail: "controller.product.getShopDetail",
    processQueue: "controller.product.processQueue",
  }
  
  const productApi = {
    name: 'controller.product.invokeServer',
    methods: {
      createDatabase: {},
      validateShopParams: {},
      addShop: {},
      addProductCategory: {},
      deleteProductCategory: {},
      addProductList: {},
      deleteShopById: {},
      updateProductShelf: {},
      updateShopAttributes: {},
      authenticatePermission: {},
      addAdministrator: {},
      loginAuthentication: {},
      updatePassword: {},
      updateSettings: {},
      getProductCategories: {},
      getProductListsByCategory: {},
      getAvailableProductLists: {},
      controlDataFetching: {},
      controlAllUsersAutoStocking: {},
      startAutoProductListing: {},
      getShops: {},
      getShop: {},
      getCookies: {},
      setCookies: {},
      bindShopUrls: {},
      queryBindShopUrls: {},
    }
  }
  
  const groupApi = (group, method) => {
    return ipcApiRoute[group][method]
  }
  
  const product = (method) => {
    return groupApi('product', method);
  }
  
  const specialIpcRoute = {
    appUpdater: 'app.updater',
    window1ToWindow2: 'window1-to-window2',
    window2ToWindow1: 'window2-to-window1',
  }
  
  
  export {
    ipcApiRoute,
    specialIpcRoute,
    groupApi,
    product,
    productApi,
  }
  