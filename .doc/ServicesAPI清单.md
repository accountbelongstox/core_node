# productController API清单
productController.init() # Initializes necessary services (product, pddscratch, pddcookies, pddbackload) and sets up socket communication.
productController.emitSocket(method, params, callback, exclude) # Emits a socket message to the client-listing with specified method, params, and callback.
productController.invokeServer(data, ...args) # Invokes a method on the 'product' service with the provided data and additional arguments.
productController.getCookies(params) # Manages a queue of tasks related to fetching cookies, adds tasks, and processes them.
productController.getShopDetail(params) # Retrieves shop details using the pddscratch service.
productController.toCellecting(params) # Initiates collecting using the pddbackload service.
productController.processQueue() # Processes the collecting queue using the pddbackload service.
productController.controlDataFetching(params) # Controls the data fetching process based on the provided parameters.
productController.scratch_pdd() # Placeholder method, awaiting implementation.


Service.const Services = require('ee-core/services');
const productService = Services.get('product');
# productService API清单
productService.init(emitSok) - 初始化ProductService并设置提供的socket emitter。
productService.createTable(tablename, initArray = [], force = false) - 在数据库中创建具有给定名称、初始数据和可选强制重建的表。
productService.JSON(data) - 使用spider utility将数据转换为JSON格式。
productService.setTable(tablename, initArray = []) - 设置数据库中表的数据。
productService.validateShopParams(obj) - 验证商店对象的参数。
productService.formatShopProperties(obj, exclude) - 格式化商店属性，排除指定的属性。
productService.resetShopProperties(obj) - 重置商店对象的特定属性。
productService.getShopPropretiesExclude() - 返回要从商店对象中排除的属性列表。
productService.verifyShopPropretiesKeys(obj) - 验证商店对象是否包含被排除的属性。
productService.addShop(shopParams) - 将新商店添加到数据库。
productService.updateShop(params) - 更新数据库中的现有商店。
productService.getShop(shopId) - 从数据库中检索特定商店。
productService.getShops() - 从数据库中检索所有商店。
productService.bindShopUrls(params) - 将URL绑定到数据库中的特定商店，根据需要添加或更新它们。
productService.queryBindShopUrls(params) - 查询商店的绑定URL信息，根据提供的参数返回相应数据。
productService.deleteShop(params) - 删除特定商店，根据提供的商店ID进行操作。
productService.addProductCategory(categoryName) - 添加新的产品类别到数据库。
productService.deleteProductCategory(categoryId) - 删除特定产品类别，根据提供的类别ID进行操作。
productService.getProductList(params, format = false) - 获取特定产品列表的数据，根据提供的参数进行过滤。
productService.getProductListsByCategory(params) - 获取特定产品类别的所有产品列表。
productService.addProductList(params) - 添加新的产品列表到数据库，根据提供的参数进行操作。
productService.updateProductShelf(productListIds, shopId) - 更新商店的产品货架，根据提供的产品列表ID和商店ID进行操作。
productService.updateShopAttributes(updates, shopId) - 更新商店属性，根据提供的更新和商店ID进行操作。
productService.authenticatePermission(accountId) - 验证用户权限，根据提供的账户ID进行操作。
productService.addAdministrator(account, password, permissions) - 添加管理员账户到数据库，根据提供的账户信息进行操作。
productService.loginAuthentication(account, password) - 用户登录验证，根据提供的账户和密码进行操作。
productService.updatePassword(account, oldPassword, newPassword) - 更新用户密码，根据提供的账户、旧密码和新密码进行操作。
productService.updateSettings(settings) - 更新系统设置，根据提供的设置信息进行操作。
productService.getProductCategories() - 获取所有产品类别的数据。
productService.getProductCategoriesAndCount(noCollection = false, max = 10) - 获取产品类别及其产品数量信息。
productService.getProductCategoriesByNoCollection(max = 10) - 获取没有收藏的产品类别信息。
productService.getAvailableProductLists(storeId, categoryIds) - 获取可用的产品列表，根据提供的商店ID和类别ID进行操作。
productService.controlAllUsersAutoStocking(start) - 控制所有用户的自动库存功能，根据提供的参数进行操作。
productService.startAutoProductListing(storeId, quantity) - 启动或停止商店的自动产品上架功能，根据提供的商店ID和数量进行操作。
productService.setCookies(params) - 设置Cookie信息，根据提供的参数进行操作。
productService.getCookies(params) - 获取Cookie信息，根据提供的参数进行操作。
productService.getCookiesInner(params) - 获取内部的Cookie信息，进行额外处理并返回。
productService.json(input) - 解析JSON字符串或返回原始输入。

const pddscratchService = Services.get('pddscratch');
pddscratchService.init(emitSok) # 初始化服务，设置Socket
# pddscratchService API清单
pddscratchService.closeBrowser(id) # 关闭指定id的浏览器
pddscratchService.createOrGetBrowser(id, params) # 创建或获取浏览器，可传入参数设置
pddscratchService.setBrowserData(browser, cookieData, setTokenInstance) # 设置浏览器的cookie、localStorage和sessionStorage数据
pddscratchService.getProductInformation(browser) # 获取商品信息，包括图片和文本信息
pddscratchService.getShopDetail(params, inner) # 获取店铺详情，可传入参数和是否内部操作标志
pddscratchService.continue_write() # 返回数据:用户
pddscratchService.getShopDetailInnerUlr(params) # 获取店铺详情内部URL，可传入参数

const pddcookiesService = Services.get('pddcookies');
# pddcookiesService API清单
pddcookiesService.init(emitSok) # Initializes the PddcookiesService with the provided emitSok function for socket communication.
pddcookiesService._fetchCookies(params, browser) # Fetches cookies based on the provided parameters and browser instance.
pddcookiesService.cookiesShop(browser, params, cookieData, getCookieEvent, resolve) # Handles the cookie retrieval process for the "cookiesShop" identifyType.
pddcookiesService.productLogin(browser, params, cookieData, getCookieEvent, resolve) # Handles the cookie retrieval process for the "productLogin" identifyType.
pddcookiesService._isLoggedType(identifyType, url) # Checks if the provided URL corresponds to the specified identifyType.
pddcookiesService.generateRandom(x, y) # Generates a random number between x and y (inclusive).

const pddbackloadService = Services.get('pddbackload');
# pddbackloadService API清单
pddbackloadService.init(emitSok, collecting) # 初始化PddbackloadService并设置用于Socket通信的emitSok函数和collectingQueue队列。
pddbackloadService.productExistsInQueue(id) # 检查队列中是否存在指定id的产品。
pddbackloadService.excludeShop(obj, exclude, reset) # 从对象中排除指定的属性，可选择重置特定属性的值。
pddbackloadService.toCellecting(params) # 将产品添加到或从collectingQueue队列中，并更新相应的状态。
pddbackloadService.isConnected(product) # 检查产品的浏览器页面是否处于连接状态。
pddbackloadService.closeBroserIfExist(product) # 如果产品的浏览器存在，则关闭浏览器并清空相关属性。
pddbackloadService.processQueue() # 处理collectingQueue队列中的产品，包括创建浏览器、获取Cookie等操作。
pddbackloadService.resetProductOne(product, statusText) # 重置产品的状态，包括清除计时器、重置属性值等操作。
pddbackloadService.fetchCookie(product, callback) # 获取产品的Cookie信息，包括处理验证码、登陆流程等。
pddbackloadService.getInfoErrorText(browser) # 获取页面上的错误信息文本。
pddbackloadService.writeAccountProcess(browser, product) # 执行账号输入流程。
pddbackloadService.clickLoginProcess(browser, product) # 执行点击登录按钮流程。
pddbackloadService.clickVerifyProcess(browser, product) # 执行点击验证码获取按钮流程。
pddbackloadService.verifyCodeProcess(browser, product) # 执行验证码校验流程。
pddbackloadService.extractCookie(browser, product, callback) # 提取产品的Cookie信息，包括获取cookie、localStorage和sessionStorage数据。
pddbackloadService.performShipping(product) # 执行商品发布流程，包括点击发布按钮、输入商品名称等。
