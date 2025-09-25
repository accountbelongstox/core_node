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

const { Sequelize, Model, QueryTypes } = require('sequelize');
const logger = require('#@logger');
const { buildWhereClause, buildSqlConditions } = require('../sequelize-libs/where_builder');


async function dbQuery(sequelize, options = {}) {
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
async function dbQueryCount(sequelize, options = {}) {
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
    dbQuery,
    dbQueryCount
}; 