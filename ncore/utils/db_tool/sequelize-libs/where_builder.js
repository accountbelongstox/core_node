const { Op } = require('sequelize');
const logger = require('#@logger');

/**
 * @typedef {Object} WhereConditionExample
 * @property {Object} basic - Basic equality condition
 * @property {number} basic.id - Record ID
 * @property {string} basic.status - Status field
 * @property {Object} comparison - Comparison operators
 * @property {Object} comparison.age - Age field conditions
 * @property {number} comparison.age.$gt - Greater than
 * @property {number} comparison.age.$gte - Greater than or equal
 * @property {number} comparison.age.$lt - Less than
 * @property {number} comparison.age.$lte - Less than or equal
 * @property {number} comparison.age.$ne - Not equal
 * @property {Object} search - Search conditions
 * @property {Object} search.name - Name field conditions
 * @property {string} search.name.$like - LIKE pattern match
 * @property {Object} search.email - Email field conditions
 * @property {string} search.email.$like - LIKE pattern match for email
 * @property {Object} range - Range conditions
 * @property {Object} range.date - Date field conditions
 * @property {Array<string|number|Date>} range.date.$between - Between range for date
 * @property {Object} range.price - Price field conditions
 * @property {Array<number>} range.price.$between - Between range for price
 * @property {Object} lists - List conditions
 * @property {Object} lists.status - Status field conditions
 * @property {Array<string>} lists.status.$in - IN list
 * @property {Array<string>} lists.status.$notIn - NOT IN list
 * @property {Object} null - NULL conditions
 * @property {Object} null.description - Description field conditions
 * @property {boolean} null.description.$null - IS NULL or IS NOT NULL
 * @property {Object} null.deletedAt - DeletedAt field conditions
 * @property {boolean} null.deletedAt.$null - IS NULL or IS NOT NULL for deletedAt
 */

/**
 * Example of how to use where conditions
 * @type {Object}
 */
const whereConditionExample = {
    // Direct equality
    id: 1,
    status: 'active',
    
    // Greater than
    age: { $gt: 18 },              // age > 18
    price: { $gte: 100 },          // price >= 100
    
    // Less than
    count: { $lt: 1000 },          // count < 1000
    stock: { $lte: 50 },           // stock <= 50
    
    // Not equal
    type: { $ne: 'deleted' },      // type != 'deleted'
    
    // Pattern matching
    name: { $like: '%John%' },     // name LIKE '%John%'
    email: { $like: 'test@%' },    // email LIKE 'test@%'
    
    // Range queries
    created_at: { $between: ['2023-01-01', '2023-12-31'] },  // created_at BETWEEN '2023-01-01' AND '2023-12-31'
    amount: { $between: [1000, 5000] },                      // amount BETWEEN 1000 AND 5000
    
    // List queries
    category: { $in: ['A', 'B', 'C'] },           // category IN ('A', 'B', 'C')
    tag: { $notIn: ['deleted', 'hidden'] },       // tag NOT IN ('deleted', 'hidden')
    
    // NULL checks
    description: { $null: true },                 // description IS NULL
    deleted_at: { $null: false }                  // deleted_at IS NOT NULL
};

/**
 * Build where clause from query conditions
 * @param {Object} conditions - Query conditions
 * @returns {Object} Sequelize where clause
 * @example
 * // Basic equality
 * { field: value }
 * // Greater than
 * { field: { $gt: value } }
 * // Less than
 * { field: { $lt: value } }
 * // Between
 * { field: { $between: [min, max] } }
 * // Not equal
 * { field: { $ne: value } }
 * // Like
 * { field: { $like: '%value%' } }
 * // In array
 * { field: { $in: [value1, value2] } }
 * // Is null
 * { field: { $null: true } }
 * // Is not null
 * { field: { $null: false } }
 */
function buildWhereClause(conditions) {
    if (!conditions || Object.keys(conditions).length === 0) {
        return {};
    }

    const where = {};
    for (const [field, condition] of Object.entries(conditions)) {
        if (condition === null) {
            where[field] = null;
            continue;
        }

        if (typeof condition === 'object' && !Array.isArray(condition)) {
            const operators = {
                $gt: Op.gt,
                $gte: Op.gte,
                $lt: Op.lt,
                $lte: Op.lte,
                $ne: Op.ne,
                $like: Op.like,
                $between: Op.between,
                $in: Op.in,
                $notIn: Op.notIn,
                $null: null
            };

            const sequelizeCondition = {};
            for (const [op, value] of Object.entries(condition)) {
                if (op === '$null') {
                    if (value === true) {
                        sequelizeCondition[Op.is] = null;
                    } else {
                        sequelizeCondition[Op.not] = null;
                    }
                    continue;
                }

                const sequelizeOp = operators[op];
                if (!sequelizeOp) {
                    logger.warn(`Unknown operator: ${op}`);
                    continue;
                }
                sequelizeCondition[sequelizeOp] = value;
            }
            where[field] = sequelizeCondition;
        } else {
            where[field] = condition;
        }
    }
    return where;
}

/**
 * Build SQL WHERE clause from raw where conditions
 * @param {Object} whereClause - Raw where conditions like whereConditionExample
 * @returns {string} SQL WHERE clause without 'WHERE' keyword, empty string if no conditions
 * @example
 * // Input:
 * {
 *   id: 1,
 *   age: { $gt: 18 },
 *   name: { $like: '%John%' },
 *   status: { $in: ['active', 'pending'] },
 *   description: { $null: true }
 * }
 * // Output:
 * "id = 1 AND age > 18 AND name LIKE '%John%' AND status IN ('active', 'pending') AND description IS NULL"
 */
function buildSqlConditions(whereClause) {
    if (!whereClause || Object.keys(whereClause).length === 0) {
        return '';
    }

    const conditions = [];
    
    for (const [field, value] of Object.entries(whereClause)) {
        if (value === null) {
            conditions.push(`${field} IS NULL`);
        } else if (typeof value === 'object' && !Array.isArray(value)) {
            const [[op, val]] = Object.entries(value);
            
            switch (op) {
                case '$gt':
                    conditions.push(`${field} > ${formatValue(val)}`);
                    break;
                case '$gte':
                    conditions.push(`${field} >= ${formatValue(val)}`);
                    break;
                case '$lt':
                    conditions.push(`${field} < ${formatValue(val)}`);
                    break;
                case '$lte':
                    conditions.push(`${field} <= ${formatValue(val)}`);
                    break;
                case '$ne':
                    conditions.push(`${field} != ${formatValue(val)}`);
                    break;
                case '$like':
                    conditions.push(`${field} LIKE ${formatValue(val)}`);
                    break;
                case '$between':
                    conditions.push(`${field} BETWEEN ${formatValue(val[0])} AND ${formatValue(val[1])}`);
                    break;
                case '$in':
                    conditions.push(`${field} IN (${val.map(v => formatValue(v)).join(', ')})`);
                    break;
                case '$notIn':
                    conditions.push(`${field} NOT IN (${val.map(v => formatValue(v)).join(', ')})`);
                    break;
                case '$null':
                    conditions.push(val ? `${field} IS NULL` : `${field} IS NOT NULL`);
                    break;
            }
        } else {
            conditions.push(`${field} = ${formatValue(value)}`);
        }
    }

    return conditions.join(' AND ');
}

/**
 * Format value for SQL query
 * @private
 * @param {*} value - Value to format
 * @returns {string} Formatted value
 */
function formatValue(value) {
    if (value === null) {
        return 'NULL';
    }
    if (typeof value === 'string') {
        return `'${value.replace(/'/g, "''")}'`;
    }
    if (value instanceof Date) {
        return `'${value.toISOString()}'`;
    }
    return value.toString();
}

module.exports = {
    buildWhereClause,
    buildSqlConditions
}; 