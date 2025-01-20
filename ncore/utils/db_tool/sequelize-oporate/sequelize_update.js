const { Sequelize, QueryTypes } = require('sequelize');
const logger = require('#@logger');
const { buildWhereClause, buildSqlConditions } = require('../sequelize-libs/where_builder');

/**

 * // Single update
 * await update(sequelize, {
 *   tableName: 'users',
 *   where: { id: 1 },
 *   data: { status: 'active' }
 * });
 * 
 * // Bulk update with same data
 * await update(sequelize, {
 *   tableName: 'users',
 *   where: { status: 'pending' },
 *   data: { status: 'active' }
 * });
 * 
 * // Bulk update with different data
 * await update(sequelize, {
 *   tableName: 'users',
 *   data: [
 *     { where: { id: 1 }, data: { status: 'active' } },
 *     { where: { id: 2 }, data: { status: 'inactive' } }
 *   ]
 * });
 */
async function update(sequelize, options = {}) {
    if(!options.model && options.models && options.tableName) {
        options.model = options.models[options.tableName]
    }
    const {
        model,
        tableName,
        where,
        data,
        transaction: useTransaction = true
    } = options;

    if (!data) {
        return { success: false, count: 0, error: 'No data provided' };
    }

    // Handle bulk updates with different data for each record
    if (Array.isArray(data)) {
        return updateBulkDifferent(sequelize, { model, tableName, data, useTransaction });
    }

    // Handle single update or bulk update with same data
    return updateWithSameData(sequelize, { model, tableName, where, data, useTransaction });
}

/**
 * Update records with same data
 * @private
 */
async function updateWithSameData(sequelize, options) {
    if(!options.model && options.models && options.tableName) {
        options.model = options.models[options.tableName]
    }
    const { model, tableName, where, data, useTransaction } = options
    if (!where || Object.keys(where).length === 0) {
        return { success: false, count: 0, error: 'Where condition is required for update' };
    }

    let transaction;
    if (useTransaction) {
        transaction = await sequelize.transaction();
    }

    try {
        if (model) {
            const [count] = await model.update(data, {
                where: buildWhereClause(where),
                ...(transaction && { transaction })
            });

            if (transaction) await transaction.commit();
            logger.info(`Updated ${count} records using model`);
            return { success: true, count: Number(count) || 0 };
        }

        const setClause = Object.entries(data)
            .map(([key, _]) => `${key} = :${key}`)
            .join(', ');

        const whereClause = buildSqlConditions(where);
        const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`;

        const [result] = await sequelize.query(sql, {
            type: QueryTypes.UPDATE,
            replacements: {
                ...data,
            },
            raw: true,
            ...(transaction && { transaction }),
            // Don't retry on failure
            retry: { max: 0 }
        });

        if (transaction) await transaction.commit();
        return { success: true, count: Number(result) || 0 };
    } catch (error) {
        if (transaction) await transaction.rollback();
        logger.error('Error executing update:', error);
        return { success: false, count: 0, error: error.message };
    }
}

/**
 * Update multiple records with different data
 * @private
 */
async function updateBulkDifferent(sequelize, options) {
    if(!options.model && options.models && options.tableName) {
        options.model = options.models[options.tableName]
    }
    const { model, tableName, data, useTransaction } = options
    let transaction;
    if (useTransaction) {
        transaction = await sequelize.transaction();
    }

    try {
        let totalCount = 0;

        for (const item of data) {
            if (!item.where || Object.keys(item.where).length === 0) {
                logger.warn('Skipping update: Where condition is required');
                continue;
            }

            const result = await updateWithSameData(sequelize, {
                model,
                tableName,
                where: item.where,
                data: item.data,
                useTransaction: false,
                transaction
            });

            if (result.success) {
                totalCount += result.count;
            }
        }

        if (transaction) await transaction.commit();
        return { success: true, count: totalCount };
    } catch (error) {
        if (transaction) await transaction.rollback();
        logger.error('Error executing bulk update:', error);
        return { success: false, count: 0, error: error.message };
    }
}

module.exports = {
    update
}; 