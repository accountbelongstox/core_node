const logger = require('#@logger');
async function initMiddlewareDb() {
    // await initOldData();
    // await initCacheTransData();
    // await initWordQueryData();
    // await initWordInsertData();
    // await initWordUpdateData();
    logger.warn('Not implement initMiddlewareDb');
}
(async () => {
    let initDbDone = false;  
    await initMiddlewareDb();
    initDbDone = true;
    while (!initDbDone) {
        logger.info('waiting initDbDone');
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    logger.success('initMiddlewareDb done');
})();
module.exports = {
    initMiddlewareDb
}

