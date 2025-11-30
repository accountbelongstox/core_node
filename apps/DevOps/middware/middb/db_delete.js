// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const logger = require('#@logger');
const { cacheCoordinator } = require('../db-tools/cache_coordinator.js');

const getModels = null
const getDbModelByItemType = null

async function deleteContent(id, rawItemType) {
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