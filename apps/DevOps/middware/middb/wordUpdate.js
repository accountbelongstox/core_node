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
const { cacheCoordinator } = require('../../basetool/db-tool/cache_coordinator.js');
const { WrapWordTransItemNotKeepIdKey } = require('../../basetool/db-tool/trans_item_wrap.js');
const { dbUpdate } = require('#@dbtools');
const { ITEM_TYPE } = require(`../../provider/types/data_types.js`)
const { getProviderWordData, } = require('../../provider/DataProvider.js');

async function updateStaticIsExistsByMainDB(words,isExistLocal) {
    const {sequelize,wordModel} = await getProviderWordData();
    if(!words || words.length === 0 || isExistLocal === undefined) {
        logger.error('No words or isExistLocal is undefined to update static is exists');
        return {success: false, count: 0, error: 'No words or isExists is undefined to update static is exists'};
    }
    const result = await dbUpdate(sequelize,{
        model: wordModel,
        data: {isExistLocal},
        where: {
            content: {
                $in: words
            }
        }
    });
    return result;
}

async function updateContentByContent(oldContent, newContent, rawItemType) {
    const {sequelize,wordModel} = await getProviderWordData();
    try {
        const record = await wordModel.findOne({
            where: { content: oldContent }
        });
        if (!record) {
            return false;
        }
        const data = validateAndSetDefaults({
            content: newContent,
            type: rawItemType
        });

        const [updatedCount] = await wordModel.update(data, {
            where: { id: record.id }
        });

        if (updatedCount > 0) {
            cacheCoordinator.recordOperation('update', rawItemType);
            return true;
        }
        return false;
    } catch (error) {
        logger.error(`Failed to update content by content: ${error.message}`);
        return false;
    }
}

/**
 * Process a chunk of updates with transaction
 * @param {Array} chunk - Array of items to update
 * @param {string} rawItemType - Type of content
 * @param {Object} model - Sequelize model
 * @returns {Promise<{success: number, failed: number}>} Number of successful and failed updates
 */
async function processUpdateChunkWithTransaction(chunk, rawItemType, model) {
    const transaction = await model.sequelize.transaction();
    try {
        const updates = await Promise.all(chunk.map(async (item) => {
            const data = typeof item.content === "string"
                ? validateAndSetDefaults(WrapWordTransItemNotKeepIdKey(item.content, rawItemType))
                : validateAndSetDefaults(item.content);

            data.last_modified = Math.floor(Date.now() / 1000);

            const [updatedCount] = await model.update(data, {
                where: { id: item.id },
                transaction
            });
            return updatedCount;
        }));

        await transaction.commit();
        const successCount = updates.reduce((sum, count) => sum + (count > 0 ? 1 : 0), 0);
        if (successCount > 0) {
            cacheCoordinator.recordOperation('update', rawItemType);
        }
        return {
            success: successCount,
            failed: chunk.length - successCount
        };
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

/**
 * Determine appropriate chunk size based on array length
 * @param {number} length - Length of array
 * @returns {number} Appropriate chunk size
 */
function determineChunkSize(length) {
    if (length > 1000) return 1000;
    if (length > 100) return 100;
    return length;
}

/**
 * Recursively process updates with dynamic chunk sizes
 * @param {Array} items - Array of items to update
 * @param {string} rawItemType - Type of content
 * @param {Object} model - Sequelize model
 * @returns {Promise<{success: number, failed: number}>} Number of successful and failed updates
 */
async function processUpdatesRecursively(items, rawItemType, model) {
    // Base case: empty array
    if (!items.length) {
        return { success: 0, failed: 0 };
    }

    // Base case: single item
    if (items.length === 1) {
        const data = typeof items[0].content === "string"
            ? validateAndSetDefaults(WrapWordTransItemNotKeepIdKey(items[0].content, rawItemType))
            : validateAndSetDefaults(items[0].content);

        data.last_modified = Math.floor(Date.now() / 1000);

        try {
            const [updatedCount] = await model.update(data, {
                where: { id: items[0].id }
            });
            if (updatedCount > 0) {
                cacheCoordinator.recordOperation('update', rawItemType);
                return { success: 1, failed: 0 };
            }
            return { success: 0, failed: 1 };
        } catch (error) {
            logger.error(`Failed to update item: ${error.message}`);
            return { success: 0, failed: 1 };
        }
    }

    const chunkSize = determineChunkSize(items.length);
    const result = { success: 0, failed: 0 };

    // Split array into chunks
    for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        try {
            // Try to process current chunk with transaction
            const chunkResult = await processUpdateChunkWithTransaction(chunk, rawItemType, model);
            result.success += chunkResult.success;
            result.failed += chunkResult.failed;
        } catch (error) {
            logger.warn(`Chunk update failed (size: ${chunk.length}), splitting into smaller chunks: ${error.message}`);

            if (chunk.length <= 100) {
                // If chunk is small enough, process items individually
                logger.warn(`Processing ${chunk.length} items individually`);
                for (const item of chunk) {
                    const data = typeof item.content === "string"
                        ? validateAndSetDefaults(WrapWordTransItemNotKeepIdKey(item.content, rawItemType))
                        : validateAndSetDefaults(item.content);

                    data.last_modified = Math.floor(Date.now() / 1000);

                    try {
                        const [updatedCount] = await model.update(data, {
                            where: { id: item.id }
                        });
                        if (updatedCount > 0) {
                            result.success++;
                            cacheCoordinator.recordOperation('update', rawItemType);
                        } else {
                            result.failed++;
                        }
                    } catch (error) {
                        logger.error(`Failed to update item: ${error.message}`);
                        result.failed++;
                    }
                }
            } else {
                // Recursively process smaller chunks
                const newChunkSize = determineChunkSize(chunk.length / 2);
                const subChunks = [];
                for (let j = 0; j < chunk.length; j += newChunkSize) {
                    subChunks.push(chunk.slice(j, j + newChunkSize));
                }

                for (const subChunk of subChunks) {
                    const subResult = await processUpdatesRecursively(subChunk, rawItemType, model);
                    result.success += subResult.success;
                    result.failed += subResult.failed;
                }
            }
        }
    }

    return result;
}

/**
 * Update multiple items with recursive retry on failure
 * @param {Array<{id: number, content: Object|string, type: string}>} items - Array of items to update
 * @returns {Promise<{success: number, failed: number}>} Number of successful and failed updates
 */
async function bulkUpdateContentWithRetry(items) {
    const {sequelize,wordModel} = await getProviderWordData();

    // Group items by type to handle different models
    const itemsByType = items.reduce((acc, item) => {
        const type = item.type || ITEM_TYPE.WORD;
        if (!acc[type]) acc[type] = [];
        acc[type].push(item);
        return acc;
    }, {});

    const result = { success: 0, failed: 0 };

    // Process each type separately
    await Promise.all(Object.entries(itemsByType).map(async ([type, typeItems]) => {
        try {
            const typeResult = await processUpdatesRecursively(typeItems, type, model);
            result.success += typeResult.success;
            result.failed += typeResult.failed;
        } catch (error) {
            logger.error(`Failed to process ${type} updates: ${error.message}`);
            result.failed += typeItems.length;
        }
    }));

    return result;
}

/**
 * Bulk update multiple records in a single transaction
 * @param {Array<{id: number, content: Object|string, type: string}>} items - Array of items to update
 * @returns {Promise<{success: number, failed: number}>} Number of successful and failed updates
 */
async function bulkUpdateContent(items) {
    const {sequelize,wordModel} = await getProviderWordData();
    const currentTime = Math.floor(Date.now() / 1000);

    // Group items by type to handle different models
    const itemsByType = items.reduce((acc, item) => {
        const type = item.type || ITEM_TYPE.WORD;
        if (!acc[type]) acc[type] = [];
        acc[type].push(item);
        return acc;
    }, {});

    const result = { success: 0, failed: 0 };

    // Process each type in a separate transaction
    await Promise.all(Object.entries(itemsByType).map(async ([type, typeItems]) => {
            const model = wordModel;

        try {
            const transaction = await model.sequelize.transaction();
            try {
                const updates = typeItems.map(item => {
                    const data = typeof item.content === "string"
                        ? validateAndSetDefaults(WrapWordTransItemNotKeepIdKey(item.content, type))
                        : validateAndSetDefaults(item.content);

                    data.last_modified = currentTime;

                    return model.update(data, {
                        where: { id: item.id },
                        transaction
                    });
                });

                const results = await Promise.all(updates);
                const successCount = results.reduce((sum, [count]) => sum + (count > 0 ? 1 : 0), 0);

                result.success += successCount;
                result.failed += (typeItems.length - successCount);

                if (successCount > 0) {
                    cacheCoordinator.recordOperation('update', type);
                }

                await transaction.commit();
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
        } catch (error) {
            logger.error(`Failed to bulk update ${type} contents: ${error.message}`);
            result.failed += typeItems.length;
        }
    }));

    return result;
}

module.exports = {
    updateStaticIsExistsByMainDB,
    updateContentByContent,
    bulkUpdateContent,
    bulkUpdateContentWithRetry,
}; 