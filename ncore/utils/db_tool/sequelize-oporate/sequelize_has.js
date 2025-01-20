const { Sequelize, Model, QueryTypes, Op } = require('sequelize');
const logger = require('#@logger');
const { buildWhereClause, buildSqlConditions } = require('../sequelize-libs/where_builder');
const { cacheCoordinator, recordOperation } = require('../sequelize-libs/cache_coordinator');


async function has(sequelize, options = {}) {
    
    if(!options.model && options.models && options.tableName) {
        options.model = options.models[options.tableName]
    }
    const {
        model,
        tableName,
        where,
        memoryData,
        compareFields,
        useCache = true,
        ignoreChanges = false
    } = options;

    if (!where) {
        return { exists: false, matches: [] };
    }

    const targetTable = tableName || (model && model.tableName);
    if (!targetTable) {
        throw new Error('Either model or tableName must be provided');
    }

    // Convert single where condition to array for unified processing
    const conditions = Array.isArray(where) ? where : [where];

    // Check if we can use cached data
    if (useCache && !memoryData) {
        const needsUpdate = cacheCoordinator.needsCacheUpdate(targetTable, ignoreChanges);
        const cachedData = cacheCoordinator.getCache(targetTable);

        if (!needsUpdate && cachedData) {
            logger.info(`[Cache] Using cached data for ${targetTable}`);
            return checkInMemory(conditions, cachedData, compareFields);
        }
    }

    // If memory data is provided, perform in-memory check
    if (Array.isArray(memoryData)) {
        return checkInMemory(conditions, memoryData, compareFields);
    }

    // Otherwise, perform database check
    const result = await checkInDatabase(sequelize, { model, tableName: targetTable, conditions });
    
    // Record the query operation
    recordOperation('query', targetTable);

    // Cache the results if needed
    if (useCache && result.matches.length > 0) {
        cacheCoordinator.setCache(targetTable, result.matches);
    }

    return result;
}

/**
 * Check conditions in memory
 * @private
 */
function checkInMemory(conditions, memoryData, compareFields) {
    const matches = [];

    for (const condition of conditions) {
        // Use specified compare fields or all fields in condition
        const fieldsToCompare = compareFields || Object.keys(condition);
        
        const matchedRecords = memoryData.filter(record => {
            return fieldsToCompare.every(field => {
                const conditionValue = condition[field];
                const recordValue = record[field];

                // Handle special operators
                if (conditionValue && typeof conditionValue === 'object') {
                    const [[op, value]] = Object.entries(conditionValue);
                    switch (op) {
                        case '$gt': return recordValue > value;
                        case '$gte': return recordValue >= value;
                        case '$lt': return recordValue < value;
                        case '$lte': return recordValue <= value;
                        case '$ne': return recordValue !== value;
                        case '$like':
                            const pattern = value.replace(/%/g, '.*');
                            return new RegExp(pattern).test(recordValue);
                        case '$in': return value.includes(recordValue);
                        case '$notIn': return !value.includes(recordValue);
                        case '$null': return value ? recordValue === null : recordValue !== null;
                        default: return recordValue === value;
                    }
                }

                return recordValue === conditionValue;
            });
        });

        matches.push(...matchedRecords);
    }

    // Remove duplicates
    const uniqueMatches = [...new Map(matches.map(item => [item.id, item])).values()];

    return {
        exists: uniqueMatches.length > 0,
        matches: uniqueMatches
    };
}

/**
 * Check conditions in database
 * @private
 */
async function checkInDatabase(sequelize, options) {
    
    if(!options.model && options.models && options.tableName) {
        options.model = options.models[options.tableName]
    }
    const { model, tableName, conditions } = options
    
    try {
        if (model) {
            const matches = await model.findAll({
                where: {
                    [Op.or]: conditions.map(buildWhereClause)
                },
                raw: true
            });

            return {
                exists: matches.length > 0,
                matches
            };
        }

        // Build OR conditions for each where clause
        const whereConditions = conditions.map(buildSqlConditions).filter(Boolean);
        if (whereConditions.length === 0) {
            return { exists: false, matches: [] };
        }

        const sql = `SELECT * FROM ${tableName} WHERE ${whereConditions.join(' OR ')}`;

        const matches = await sequelize.query(sql, {
            type: QueryTypes.SELECT,
            raw: true,
            nest: false
        });

        return {
            exists: matches.length > 0,
            matches
        };
    } catch (error) {
        logger.error('Error checking existence:', error);
        return { exists: false, matches: [], error: error.message };
    }
}

module.exports = {
    has
}; 