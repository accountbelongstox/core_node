const { Sequelize, QueryTypes } = require('sequelize');
const logger = require('#@logger');
const { buildWhereClause, buildSqlConditions } = require('../sequelize-libs/where_builder');
const { message } = require('statuses');

async function softDelete(sequelize, options = {}) {
    if(!options.model && options.models && options.tableName) {
        options.model = options.models[options.tableName]
    }
    try {
        const {
            models,
            model,
            tableName,
            where = {}
        } = options;

        const whereClause = buildWhereClause(where);

        if (model) {
            const count = await model.update(
                { deleted_at: new Date() },
                { where: whereClause }
            );

            logger.info(`Soft deleted ${count} records using model`);
            return {
                success: true,
                count: Number(count) || 0
            };
        } else {
            const updateSql = `UPDATE ${tableName} SET deleted_at = :deleted_at WHERE ${buildSqlConditions(where)}`;

            const [result] = await sequelize.query(
                updateSql,
                {
                    // Query type affects how results are formatted
                    type: QueryTypes.UPDATE,
                    
                    // Named parameter replacements
                    replacements: {
                        deleted_at: new Date().toISOString()
                    },
                    
                    // Don't try to map results to a model
                    raw: true,
                    
                    // Don't transform results into nested objects
                    nest: false,
                    
                    // Don't return a single row
                    plain: false
                }
            );

            logger.info(`Soft deleted ${result} records from ${tableName}`);
            return {
                success: true,
                count: Number(result) || 0
            };
        }
    } catch (error) {
        logger.error('Error executing soft delete operation:', error);
        return {
            success: false,
            count: 0,
            error: error.message
        };
    }
}

async function hardDelete(sequelize, options = {}) {
    if(!options.model && options.models && options.tableName) {
        options.model = options.models[options.tableName]
    }
    try {
        const {
            model,
            models,
            tableName,
            where = {}
        } = options;

        const whereClause = buildWhereClause(where);

        if (model) {
            const count = await model.destroy({
                where: whereClause
            });

            logger.info(`Hard deleted ${count} records using model`);
            return {
                success: true,
                count: Number(count) || 0
            };
        } else {
            const deleteSql = `DELETE FROM ${tableName} WHERE ${buildSqlConditions(where)}`;
            await sequelize.query(
                deleteSql,
                {
                    // Query type affects how results are formatted
                    type: QueryTypes.DELETE,
                    
                    // Don't try to map results to a model
                    raw: true,
                    
                    // Don't transform results into nested objects
                    nest: false,
                    
                    // Don't return a single row
                    plain: false,
                    
                    // Don't retry on failure
                    retry: {
                        max: 0
                    }
                }
            );
            return {
                success: true,
                message: `Hard deleted records from ${tableName}`
            };
        }
    } catch (error) {
        logger.error('Error executing hard delete operation:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

module.exports = {
    softDelete,
    hardDelete
}; 