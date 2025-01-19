const logger = require('#@logger');
const { ITEM_TYPE, detectContentTypeAndDbModel, getDbModelByItemType } = require('../db-tools/db_utils.js');
const { ensureInitialized, getModels } = require('../init/db_init.js');
const { cacheCoordinator } = require('../db-tools/cache_coordinator.js');

async function deleteContent(id, rawItemType) {
    await ensureInitialized();
    const models = getModels();
    const model = getDbModelByItemType(rawItemType, models);
    
    try {
        const record = await model.findOne({
            where: { id },
            attributes: ['content']
        });
        
        if (!record) {
            return false;
        }
        
        const result = await model.destroy({
            where: { id }
        });
        
        if (result > 0) {
            cacheCoordinator.recordOperation('delete', rawItemType);
            return true;
        }
        return false;
    } catch (error) {
        logger.error(`Failed to delete content: ${error.message}`);
        return false;
    }
}

async function deleteContentByContent(content, rawItemType) {
    await ensureInitialized();
    const models = getModels();
    const model = getDbModelByItemType(rawItemType, models);
    
    try {
        const result = await model.destroy({
            where: { content }
        });
        
        if (result > 0) {
            cacheCoordinator.recordOperation('delete', rawItemType);
            return true;
        }
        return false;
    } catch (error) {
        logger.error(`Failed to delete content by content: ${error.message}`);
        return false;
    }
}

async function deleteContentArray(contentArray, rawItemType) {
    if (!Array.isArray(contentArray) || contentArray.length === 0) {
        return false;
    }

    await ensureInitialized();
    const models = getModels();
    const model = getDbModelByItemType(rawItemType, models);
    
    const transaction = await model.sequelize.transaction();
    
    try {
        const deletedCount = await model.destroy({
            where: {
                content: contentArray
            },
            transaction
        });
        
        await transaction.commit();
        
        if (deletedCount > 0) {
            cacheCoordinator.recordOperation('delete', rawItemType);
            return true;
        }
        return false;
    } catch (error) {
        await transaction.rollback();
        logger.error(`Failed to delete content array: ${error.message}`);
        return false;
    }
}

module.exports = {
    deleteContent,
    deleteContentByContent,
    deleteContentArray
}; 