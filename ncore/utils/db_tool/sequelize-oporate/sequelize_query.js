const { Sequelize, Model, QueryTypes } = require('sequelize');
const logger = require('#@logger');
const { buildWhereClause, buildSqlConditions } = require('../sequelize-libs/where_builder');


async function query(sequelize, options = {}) {
    try {
        if(!options.model && options.models && options.tableName) {
            options.model = options.models[options.tableName]
        }
        const {
            models,
            model,
            tableName,
            where = {},
            attributes,
            limit,
            offset,
            order,
            raw = true,
            nest = false,
            plain = false,
            mapToModel = false
        } = options;
        const whereClause = buildWhereClause(where);

        if (model) {
            const queryOptions = {
                where: whereClause,
                raw,
                nest,
                ...(attributes && { attributes }),
                ...(limit && { limit }),
                ...(offset && { offset }),
                ...(order && { order })
            };
            return await model.findAll(queryOptions);
        } else {
            // Build raw query
            let sql = 'SELECT ';
            sql += attributes ? attributes.join(', ') : '*';
            sql += ` FROM ${tableName}`;
            
            if (Object.keys(whereClause).length > 0) {
                const whereSqlClause = buildSqlConditions(where);
                if (whereSqlClause) {
                    sql += ` WHERE ${whereSqlClause}`;
                }
                
                return await sequelize.query(sql, {
                    type: QueryTypes.SELECT,
                    raw,
                    nest,
                    plain,
                    mapToModel,
                    retry: {
                        max: 0
                    }
                });
            }
            
            return await sequelize.query(sql, {
                type: QueryTypes.SELECT,
                raw,
                nest,
                plain,
                mapToModel,
                retry: { max: 0 }
            });
        }
    } catch (error) {
        logger.error('Error executing query:', error);
        return [];
    }
}

/**
 * Get total count of records
 * // With model
 * const count = await count(sequelize, {
 *     model: UserModel,
 *     where: { status: 'active' }
 * });
 * 
 * // Without model (raw query)
 * const count = await count(sequelize, {
 *     tableName: 'users',
 *     where: { age: { $gt: 18 } }
 * });
 */
async function count(sequelize, options = {}) {
    if(!options.model && options.models && options.tableName) {
        options.model = options.models[options.tableName]
    }
    try {
        const {
            model,
            tableName,
            where = {}
        } = options;

        const whereClause = buildWhereClause(where);

        if (model) {
            return await model.count({ where: whereClause });
        } else {
            // Build raw count query
            let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
            
            if (Object.keys(whereClause).length > 0) {
                const whereSqlClause = buildSqlConditions(where);
                if (whereSqlClause) {
                    sql += ` WHERE ${whereSqlClause}`;
                }
                
                const result = await sequelize.query(sql, {
                    type: QueryTypes.SELECT,
                    raw: true,
                    nest: false,
                    plain: true,
                    retry: { max: 0 }
                });
                return Number(result?.count) || 0;
            }
            
            const result = await sequelize.query(sql, {
                type: QueryTypes.SELECT,
                raw: true,
                nest: false,
                plain: true,
                retry: { max: 0 }
            });
            return Number(result?.count) || 0;
        }
    } catch (error) {
        logger.error('Error executing count query:', error);
        return 0;
    }
}

module.exports = {
    query,
    count
}; 