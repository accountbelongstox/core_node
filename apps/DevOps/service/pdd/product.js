const { Storage, Service } = require('@egg/ee-core');
const UtilsHelper = require('@egg/ee-core/utils/helper');
const shortid = require('shortid');
const Addon = require('@egg/ee-core/addon');
const dbStore = Storage.connection('shopping', { driver: 'jsondb' });
const db = dbStore.db
let spiderUtil = null, emitSocket = null

class ProductService extends Service {
    constructor(ctx) {
        super(ctx);
        const methods = Object.getOwnPropertyNames(ProductService.prototype)
            .filter(name => typeof ProductService.prototype[name] === 'function' && name !== 'constructor');
        // console.log('Methods:', methods);
        console.log('Total ProductService of methods:', methods.length);
    }

    async init(emitSok) {
        this.emitSocket = emitSok
        if (!spiderUtil) {
            const spider = await Addon.get('spider');
            const { Util } = await spider.getUtil()
            spiderUtil = Util
        }
    }

    createTable(tablename, initArray = [], force = false) {
        if (!db.has(tablename).value() || force) {
            if (Array.isArray(initArray) && initArray.length) {
                initArray = initArray.map(item => ({
                    id: shortid.generate(),
                    data: item
                }));
            }
            db.set(tablename, initArray).write()
        }
        return tablename
    }


    JSON(data) {
        return spiderUtil.json.toJSON(data)
    }

    setTable(tablename, initArray = []) {
        db.set(tablename, initArray).write()
        return tablename
    }

    validateShopParams(obj) {
        if (typeof obj !== 'object' || obj === null) {
            return { success: false, message: 'Invalid parameter type. Expected an object.', data: {} };
        }
        const requiredProperties = ['account', 'password', 'deliveryQuantity',];
        for (const prop of requiredProperties) {
            if (!(prop in obj)) {
                return { success: false, message: `${prop} is a required property.`, data: {} };
            }
        }
        obj.deliveryQuantity = parseInt(obj.deliveryQuantity);
        const additionalProperties = ['categories'];
        for (const prop of additionalProperties) {
            if (prop in obj && !Array.isArray(obj[prop])) {
                return { success: false, message: `${prop} must be an array.`, data: {} };
            }
        }
        return { success: true, message: null, data: obj };
    }

    formatShopProperties(obj, exclude) {
        if (!exclude) exclude = this.getShopPropretiesExclude()
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
        return result;
    }

    resetShopProperties(obj) {
        if (obj.hasOwnProperty('needVerifyCode')) {
            obj['needVerifyCode'] = false;
        }
        if (obj.hasOwnProperty('verifyCode')) {
            obj['verifyCode'] = '';
        }
        if (obj.hasOwnProperty('statusText')) {
            obj['statusText'] = '';
        }
        return obj;
    }

    getShopPropretiesExclude() {
        const exclude = {
            'tempEvent': true,
            'timeoutEvent': true,
            'cookieEvent': true,
            'activeBrowser': true,
            'browser': {
                value: true
            }
        };
        return exclude
    }

    verifyShopPropretiesKeys(obj) {
        const keys1 = Object.keys(obj);
        const keys2 = Object.keys(this.getShopPropretiesExclude());
        const hasExcludedKey = keys2.some(key => keys1.includes(key));
        return hasExcludedKey;
    }

    addPddAccount(shopParams) {
        console.log(`shopParams`,shopParams)
        const tablename = this.createTable('pddaccounts', []);
        const validation = this.validateShopParams(shopParams);
        if (!validation.success) {
            return { success: false, message: validation.message, data: {} };
        }
        try {
            const shopId = shortid.generate();
            const createdAt = new Date();
            shopParams = this.formatShopProperties(shopParams)
            shopParams = this.resetShopProperties(shopParams)
            const data = { id: shopId, createdAt, ...shopParams };
            db.get(tablename).push(data).write();
            return { success: true, data, message: null };
        } catch (error) {
            console.error('Error storing shop:', error);
            return { success: false, message: 'Failed to store shop', data: {} };
        }
    }

    addShop(shopParams) {
        const tablename = this.createTable('shops', []);
        const validation = this.validateShopParams(shopParams);
        if (!validation.success) {
            return { success: false, message: validation.message, data: {} };
        }
        try {
            const shopId = shortid.generate();
            const createdAt = new Date();
            shopParams = this.formatShopProperties(shopParams)
            shopParams = this.resetShopProperties(shopParams)
            const data = { id: shopId, createdAt, ...shopParams };
            db.get(tablename).push(data).write();
            return { success: true, data, message: null };
        } catch (error) {
            console.error('Error storing shop:', error);
            return { success: false, message: 'Failed to store shop', data: {} };
        }
    }

    updateShop(params) {
        const {
            id,
            data
        } = params
        let shopId = id, shopParams = data
        const tablename = this.createTable('shops', []);
        let existingShop = db.get(tablename).find({ id: shopId }).value();
        if (!existingShop) {
            return { success: false, message: 'Shop not found.', data: {} };
        }
        const validation = this.validateShopParams(shopParams);
        if (!validation.success) {
            return { success: false, message: validation.message, data: {} };
        }
        try {
            const updatedAt = new Date();
            existingShop = this.formatShopProperties(existingShop)
            existingShop = this.resetShopProperties(existingShop)

            shopParams = this.formatShopProperties(shopParams)
            shopParams = this.resetShopProperties(shopParams)

            const updatedData = { ...existingShop, ...shopParams, updatedAt };
            db.get(tablename).find({ id: shopId }).assign(updatedData).write();
            return { success: true, data: updatedData, message: null };
        } catch (error) {
            console.error('Error updating shop:', error);
            return { success: false, message: 'Failed to update shop', data: {} };
        }
    }

    getShop(shopId) {
        const tablename = this.createTable('shops', []);
        try {
            let data = db.get(tablename).find({ id: shopId }).value();
            if (this.verifyShopPropretiesKeys(data)) {
                data = this.formatShopProperties(data);
                data = this.resetShopProperties(data);
                const id = data.id
                this.updateShop({ id, data });
            }
            if (data) {
                return { success: true, data, message: null };
            } else {
                return { success: false, message: 'Shop not found', data: {} };
            }
        } catch (error) {
            console.error('Error getting shop:', error);
            return { success: false, message: 'Failed to get shop', data: {} };
        }
    }

    async getShops() {
        const tablename = this.createTable('shops', []);
        try {
            let data = db.get(tablename).value();
            data.forEach(item => {
                if (this.verifyShopPropretiesKeys(item)) {
                    const id = item.id
                    this.updateShop({ id, data: item });
                }
            });
            data = this.JSON(data)
            return { success: true, data, message: null };
        } catch (error) {
            console.error('Error getting shops:', error);
            return { success: false, message: 'Failed to get shops', data: {} };
        }
    }

    bindShopUrls(params) {
        console.log(`bindShopUrls`)
        const {
            id,
            data
        } = params
        const shopId = id, validUrls = data
        const tablename = this.createTable('bind_shop_urls', []);
        if (!shopId || !data) {
            return { success: false, message: 'Requires shopId or data parameter', data: {} };
        }
        let existsCount = 0, addCount = 0
        try {
            let existingShop = db.get(tablename).find({ id: shopId }).value();
            let bindShopUrls = []
            if (existingShop && existingShop.bindShopUrls) {
                try {
                    console.log(`existingShop `, existingShop.bindShopUrls)
                    bindShopUrls = JSON.parse(existingShop.bindShopUrls)
                } catch (e) {
                    console.log(e)
                }
            }
            validUrls.forEach(url => {
                if (!bindShopUrls.includes(url)) {
                    bindShopUrls.push(url);
                    addCount++
                } else {
                    existsCount++
                }
            });
            bindShopUrls = JSON.stringify(bindShopUrls)
            const insetData = {
                id,
                bindShopUrls
            }
            if (existingShop) {
                db.get(tablename).find({ id: shopId }).assign(insetData).write();
            } else {
                db.get(tablename).push(insetData).write();
            }
            return { success: true, data: { addCount, existsCount }, message: null };
        } catch (error) {
            console.error('Error deleting shop:', error);
            return { success: false, message: 'Failed to delete shop', data: { addCount, existsCount } };
        }
    }

    queryBindShopUrls(params) {
        if (!params) params = {}
        let onlyCount = params.isCount
        const tablename = this.createTable('bind_shop_urls', []);
        try {
            if (params.id) {
                const shopId = params.id;
                const existingShop = db.get(tablename).find({ id: shopId }).value();
                if (existingShop && existingShop.bindShopUrls) {
                    try {
                        const id = existingShop.id
                        const bindShopUrls = JSON.parse(existingShop.bindShopUrls);
                        const urlsCount = bindShopUrls.length;
                        let data = onlyCount ? { id, urlsCount } : { id, bindShopUrls, urlsCount }
                        return { success: true, data, message: null };
                    } catch (e) {
                        console.error('Error parsing bindShopUrls:', e);
                        return { success: false, message: 'Failed to parse bindShopUrls', data: {} };
                    }
                } else {
                    return { success: false, message: 'No shop found with the specified ID', data: {} };
                }
            } else {
                const allShops = db.get(tablename).value();
                //为省性能，此处先省略掉
                // const resultData = allShops.map(shop => {
                //     let bindShopUrls = [];
                //     const id = shop.id
                //     if (shop.bindShopUrls) {
                //         console.log(`shop.bindShopUrls`, typeof shop.bindShopUrls)
                //         try {
                //             bindShopUrls = JSON.parse(shop.bindShopUrls);
                //         } catch (e) {
                //             console.error('Error parsing bindShopUrls:', e);
                //         }
                //         shop.bindShopUrls = bindShopUrls
                //     }
                //     const urlsCount = bindShopUrls.length;
                //     return { id, urlsCount,bindShopUrls };
                // });
                return { success: true, data: allShops, message: null };
            }
        } catch (error) {
            console.error('Error querying bindShopUrls:', error);
            return { success: false, message: 'Failed to query bindShopUrls', data: {} };
        }
    }


    deleteShop(params) {
        const tablename = this.createTable('shops', []);

        if (!params.id) {
            return { success: false, message: 'Missing shop ID in params', data: {} };
        }

        try {
            const shopId = params.id;
            const existingShop = db.get(tablename).find({ id: shopId }).value();

            if (!existingShop) {
                return { success: false, message: 'Shop not found', data: {} };
            }

            db.get(tablename).remove({ id: shopId }).write();
            return { success: true, data: existingShop, message: null };
        } catch (error) {
            console.error('Error deleting shop:', error);
            return { success: false, message: 'Failed to delete shop', data: {} };
        }
    }


    addProductCategory(categoryName) {
        const tablename = this.createTable('productCategories', []);
        try {
            const existingCategory = db.get(tablename).find({ name: categoryName }).value();
            if (existingCategory) {
                return { success: false, message: 'Category already exists', data: {} };
            }

            const categoryId = shortid.generate();
            db.get(tablename).push({ id: categoryId, name: categoryName }).write();
            return { success: true, data: { categoryId }, message: null };
        } catch (error) {
            console.error('Error adding product category:', error);
            return { success: false, message: 'Failed to add product category', data: {} };
        }
    }

    deleteProductCategory(categoryId) {
        const tablename = this.createTable('productCategories', []);
        try {
            const existingCategory = db.get(tablename).find({ id: categoryId }).value();
            if (!existingCategory) {
                return { success: false, message: 'Category not found', data: {} };
            }

            const associatedProducts = db.get('products').filter({ categoryId }).value();
            if (associatedProducts.length > 0) {
                return { success: false, message: 'Cannot delete category with associated products', data: {} };
            }

            db.get(tablename).remove({ id: categoryId }).write();
            return { success: true, message: 'Category deleted successfully', data: {} };
        } catch (error) {
            console.error('Error deleting product category:', error);
            return { success: false, message: 'Failed to delete product category', data: {} };
        }
    }

    getProductList(params, format = false) {
        const tablename = this.createTable(`productLists:${params.pid}`, JSON.stringify([]), format);
        try {
            let data = db.get(tablename).value();
            if (typeof data !== 'object') {
                data = JSON.parse(data);
            }
            if (Object.keys(params.condition || {}).length) {
                data = data.filter(item => {
                    return Object.keys(params.condition).every(key => {
                        return item[key] == params.condition[key];
                    });
                });
            }
            return { success: true, message: 'Data retrieved successfully', data };
        } catch (error) {
            console.error(error);
            return { success: false, message: error.toString(), data: {} };
        }
    }

    getProductListsByCategory(params) {
        try {
            const tablename = this.createTable(`productLists:${params.pid}`, []);
            const categoryDetails = this.getProductList({ pid: params.pid });
            if (!categoryDetails.success) {
                return { success: false, message: 'Product category not found', data: {} };
            }

            const productLists = db.get(tablename).filter({ categoryId: categoryDetails.id }).value();
            return { success: true, data: { productLists }, message: null };
        } catch (error) {
            console.error('Error during product lists retrieval:', error);
            return { success: false, message: 'Product lists retrieval failed', data: {} };
        }
    }

    addProductList(params) {
        const tablename = this.createTable(`productLists:${params.pid}`, []);
        try {
            const productObject = this.getProductList(params);
            let productList = productObject.data;

            const createAt = new Date();
            let addCount = 0;
            let existingCount = 0;
            params.products.forEach(url => {
                const urlExists = productList.some(product => product.url === url);
                if (!urlExists) {
                    productList.push({
                        url,
                        createAt,
                        createBy: params.createBy,
                        collection: false,
                        id: shortid.generate(),
                    });
                    addCount++;
                } else {
                    existingCount++;
                }
            });
            db.set(tablename, JSON.stringify(productList)).write();
            const data = {
                createAt,
                createBy: params.createBy,
                addCount,
                existingCount
            };
            return { success: true, data, message: 'Product list processed successfully' };
        } catch (error) {
            console.error('Error adding product list:', error);
            return { success: false, message: 'Failed to add product list', data: {} };
        }
    }

    updateProductShelf(productListIds, shopId) {
        const tablename = this.createTable('shops', []);
        try {
            if (!UtilsHelper.validValue(shopId) || !Array.isArray(productListIds)) {
                return { success: false, message: 'Invalid input parameters', data: {} };
            }
            const shop = db.get(tablename).find({ id: shopId }).value();
            if (!shop) {
                return { success: false, message: 'Shop not found', data: {} };
            }
            db.get(tablename)
                .find({ id: shopId })
                .update('productShelf', (productShelf) => {
                    productListIds.forEach((productId) => {
                        if (!productShelf.includes(productId)) {
                            productShelf.push(productId);
                        }
                    });
                    return productShelf;
                })
                .write();

            return { success: true, message: 'Product shelf updated successfully', data: {} };
        } catch (error) {
            console.error('Error updating product shelf:', error);
            return { success: false, message: 'Failed to update product shelf', data: {} };
        }
    }

    updateShopAttributes(updates, shopId) {
        const tablename = this.createTable('shops', []);
        try {
            if (!UtilsHelper.validValue(shopId) || typeof updates !== 'object') {
                return { success: false, message: 'Invalid input parameters', data: {} };
            }

            const shop = db.get(tablename).find({ id: shopId }).value();
            if (!shop) {
                return { success: false, message: 'Shop not found', data: {} };
            }

            db.get(tablename)
                .find({ id: shopId })
                .assign(updates)
                .write();

            return { success: true, message: 'Shop attributes updated successfully', data: {} };
        } catch (error) {
            console.error('Error updating shop attributes:', error);
            return { success: false, message: 'Failed to update shop attributes', data: {} };
        }
    }

    authenticatePermission(accountId) {
        const tablename = this.createTable('users', []);
        try {
            if (!UtilsHelper.validValue(accountId)) {
                return { success: false, message: 'Invalid account ID', data: {} };
            }

            const account = db.get(tablename).find({ id: accountId }).value();
            if (!account) {
                return { success: false, message: 'Account not found', data: {} };
            }

            const permissions = account.permissions || [];
            const isAdmin = permissions.includes('admin');
            const isOperator = permissions.includes('operator');
            const isObserver = permissions.includes('observer');

            return {
                success: true,
                isAdmin: isAdmin,
                isOperator: isOperator,
                isObserver: isObserver,
                message: '',
                data: {}
            };
        } catch (error) {
            console.error('Error authenticating permissions:', error);
            return { success: false, message: 'Failed to authenticate permissions', data: {} };
        }
    }

    addAdministrator(account, password, permissions) {
        const tablename = this.createTable('users', []);
        try {
            if (!UtilsHelper.validValue(account) || !UtilsHelper.validValue(password)) {
                return { success: false, message: 'Invalid account or password', data: {} };
            }

            const currentUser = this.getCurrentUser(); // Assuming there's a method to get the current user
            if (!currentUser || !currentUser.isAdmin) {
                return { success: false, message: 'Permission denied. Only administrators can add accounts.', data: {} };
            }

            const existingAccount = db.get(tablename).find({ account: account }).value();
            if (existingAccount) {
                return { success: false, message: 'Account already exists', data: {} };
            }

            const adminId = shortid.generate();

            db.get(tablename).push({
                id: adminId,
                account: account,
                password: password, // Note: In a real application, passwords should be securely hashed
                permissions: permissions || ['admin'], // Default to admin permission if not provided
            }).write();

            return { success: true, message: 'Administrator added successfully', data: {} };
        } catch (error) {
            console.error('Error adding administrator:', error);
            return { success: false, message: 'Failed to add administrator', data: {} };
        }
    }

    loginAuthentication(account, password) {
        const tablename = this.createTable('users', []);
        try {
            if (!UtilsHelper.validValue(account) || !UtilsHelper.validValue(password)) {
                return { success: false, message: 'Invalid account or password', data: {} };
            }
            const user = db.get(tablename).find({ account: account, password: password }).value();
            if (!user) {
                return { success: false, message: 'Invalid account or password', data: {} };
            }
            const loginDate = new Date();
            db.get(tablename).find({ account: account }).assign({
                lastLogin: user.loginDate || null,
                loginDate: loginDate,
            }).write();
            return {
                success: true,
                message: 'Login successful',
                data: {
                    user: {
                        account: user.account,
                        permissions: user.permissions,
                        loginDate: loginDate,
                        lastLogin: user.lastLogin || null,
                        avatar: user.avatar || null,
                    },
                }
            };
        } catch (error) {
            console.error('Error during login authentication:', error);
            return { success: false, message: 'Login failed', data: {} };
        }
    }

    updatePassword(account, oldPassword, newPassword) {
        const tablename = this.createTable('users', []);
        try {
            if (!UtilsHelper.validValue(account) || !UtilsHelper.validValue(oldPassword) || !UtilsHelper.validValue(newPassword)) {
                return { success: false, message: 'Invalid account, old password, or new password', data: {} };
            }
            const user = db.get(tablename).find({ account: account, password: oldPassword }).value();
            if (!user) {
                return { success: false, message: 'Invalid account or old password', data: {} };
            }
            if (user.password === oldPassword) {
                db.get(tablename).find({ account: account }).assign({ password: newPassword }).write();
                return { success: true, message: 'Password updated successfully', data: {} };
            } else {
                return { success: false, message: 'Invalid old password', data: {} };
            }
        } catch (error) {
            console.error('Error during password update:', error);
            return { success: false, message: 'Password update failed', data: {} };
        }
    }

    updateSettings(settings) {
        const tablenameMaxThreads = this.createTable('maxThreads', []);
        const tablenameFetchMode = this.createTable('fetchMode', []);
        try {
            if (!settings || !UtilsHelper.validValue(settings.maxThreads) || !UtilsHelper.validValue(settings.fetchMode)) {
                return { success: false, message: 'Invalid settings', data: {} };
            }
            db.set(tablenameMaxThreads, settings.maxThreads).write();
            db.set(tablenameFetchMode, settings.fetchMode).write();
            return { success: true, message: 'Settings updated successfully', data: {} };
        } catch (error) {
            console.error('Error during settings update:', error);
            return { success: false, message: 'Settings update failed', data: {} };
        }
    }

    getProductCategories() {
        const tablename = this.createTable('categories', ["通用", "电子产品", "服装", "家居用品", "食品和饮料", "个人护理", "图书和文具", "健身与运动", "玩具和娱乐", "手工艺品", "汽车和摩托车配件"]);
        try {
            const data = db.get(tablename).value();
            return { success: true, message: 'Categories fetched successfully', data };
        } catch (error) {
            console.error('Error during product categories retrieval:', error);
            return { success: false, message: 'Product categories retrieval failed', data: {} };
        }
    }

    getProductCategoriesAndCount(noCollection = false, max = 10) {
        try {
            const categories = this.getProductCategories();
            const result = [];
            for (let category of categories.data) {
                const params = { pid: category.id };
                const productList = this.getProductList(params);
                const dataCount = productList.data.length;
                let collectionCount = 0;
                let noCollectionArray = []
                for (let product of productList.data) {
                    if (!product.collection) {
                        collectionCount++;
                    } else {
                        if (noCollection && noCollectionArray.length < max) {
                            noCollectionArray.push(product)
                        }
                    }
                }
                const collectionProcess = dataCount > 0 ? (collectionCount / dataCount) * 100 : 0;
                const categoryData = {
                    id: category.id,
                    name: category.data,
                    dataCount,
                    collectionCount,
                    collectionProcess,
                    noCollectionArray
                };
                result.push(categoryData);
            }
            return { success: true, message: null, data: result };
        } catch (message) {
            console.error(message);
            return { success: false, message, data: {} };
        }
    }

    getProductCategoriesByNoCollection(max = 10) {
        const tablename = this.createTable('categories', []);
        try {
            const categories = this.getProductCategories();
            const result = [];
            for (let category of categories.data) {
                const params = { pid: category.id, condition: { collection: false } };
                const productList = this.getProductList(params);
                result.push(productList.data);
            }
            return { success: true, message: 'Fetched categories without collection successfully', data: result };
        } catch (error) {
            console.error('getProductCategoriesByNoCollection:', error);
            return { success: false, message: 'Failed to fetch categories without collection', data: [] };
        }
    }

    getAvailableProductLists(storeId, categoryIds) {
        const tablename = this.createTable('stores', []);
        const tablenameLists = this.createTable('lists', []);
        try {
            const storeDetails = db.get(tablename).find({ id: storeId }).value();
            if (!storeDetails) {
                return { success: false, message: 'Store not found', data: {} };
            }
            const addedProductIds = storeDetails.addedProductIds || [];
            const availableProductLists = db.get(tablenameLists)
                .filter(list => categoryIds.includes(list.categoryId) && !addedProductIds.includes(list.id))
                .value();
            return { success: true, message: 'Fetched available product lists successfully', data: availableProductLists.map(list => list.id) };
        } catch (error) {
            console.error('Error during available product lists retrieval:', error);
            return { success: false, message: 'Available product lists retrieval failed', data: {} };
        }
    }

    controlAllUsersAutoStocking(start) {
        const tablename = this.createTable('isAutoStockingEnabled', []);
        try {
            db.set(tablename, start).write();
            return { success: true, message: 'Auto stocking control executed successfully', data: { isAutoStockingEnabled: start } };
        } catch (error) {
            console.error('Error during automatic stocking control:', error);
            return { success: false, message: 'Automatic stocking control failed', data: {} };
        }
    }

    startAutoProductListing(storeId, quantity) {
        const tablename = this.createTable('stores', []);
        try {
            const store = db.get(tablename).find({ id: storeId }).value();
            if (!store) {
                return { success: false, message: 'Store not found', data: {} };
            }
            if (quantity === undefined || quantity === null) {
                quantity = store.autoListingQuantity || 0;
            }
            if (quantity > 0) {
                db.get(tablename).find({ id: storeId }).assign({ autoListing: true }).write();
                return { success: true, message: 'Automatic product listing started', data: {} };
            } else {
                db.get(tablename).find({ id: storeId }).assign({ autoListing: false }).write();
                return { success: true, message: 'Automatic product listing stopped', data: {} };
            }
        } catch (error) {
            console.error('Error during automatic product listing:', error);
            return { success: false, message: 'Failed to start/stop automatic product listing', data: {} };
        }
    }

    setCookies(params) {
        const {
            data,
            cookieOwer
        } = params;
        const tablename = this.createTable('cookies', []);
        const table = db.get(tablename)
        try {
            if (!data) {
                return { success: false, message: 'Cookie name is required', data: {} };
            }
            let oldCookie = table
                .filter({ cookieOwer })
                .value();
            if (oldCookie && oldCookie.length) {
                table.find({ cookieOwer }).assign(params).write()
            } else {
                table.push(params).write()
            }
            console.log(`params`, table.value())
            return { success: true, message: 'Cookie set successfully', data: {} };
        } catch (error) {
            console.error('Error during setting cookie:', error);
            return { success: false, message: 'Failed to set cookie', data: {} };
        }
    }

    getCookies(params) {
        const {
            cookieOwer
        } = params;
        const tablename = this.createTable('cookies', []);
        const table = db.get(tablename)
        try {
            let cookieValue = table.filter({ cookieOwer }).value();
            if (!cookieValue) {
                return { success: false, message: 'Cookie not found', data: {} };
            }
            cookieValue = this.json(cookieValue);
            return { success: true, message: 'Cookie fetched successfully', data: cookieValue };
        } catch (error) {
            console.error('Error during getting cookie:', error);
            return { success: false, message: 'Failed to get cookie', data: {} };
        }
    }

    getCookiesInner(params) {
        function isEmptyData(input) {
            if (typeof input === 'string') {
                try {
                    input = JSON.parse(input);
                } catch (error) {
                    return false;
                }
            }
            if (Array.isArray(input)) {
                return input.length === 0;
            }
            if (typeof input === 'object' && input !== null) {
                return Object.keys(input).length === 0;
            }
            return false;
        }
        const cookieData = this.getCookies(params);
        if (cookieData && cookieData.data && cookieData.data.length) {
            const dataObj = cookieData.data[0].data;
            if (dataObj) {
                if (isEmptyData(dataObj.cookie)) {
                    dataObj.cookie = null;
                }
                if (isEmptyData(dataObj.localStorageData)) {
                    dataObj.localStorageData = null;
                }
                if (isEmptyData(dataObj.sessionStorageData)) {
                    dataObj.sessionStorageData = null;
                }
                return dataObj;
            }
        }
        return null;
    }

    json(input) {
        if (typeof input === 'string') {
            try {
                return JSON.parse(input);
            } catch (error) {
                console.error("Invalid JSON string:", error);
                return {};
            }
        }
        return input;
    }

}




ProductService.toString = () => '[class ProductService]';
module.exports = ProductService;
