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

/**
 * Get table structure information from the database
 * @param {Sequelize} sequelize - Sequelize instance
 * @param {Object} options - Options for getting table structure
 * @returns {Promise<Object>} Table structure information
 */
async function getTableStructure(sequelize, options = {}) {
    try {
        if(typeof options === 'string'){
            options = {
                tableName: options,
                schema: 'public',
                raw: true
            }
        }
        const {
            tableName,
            schema = 'public',  // Default schema for PostgreSQL
            raw = true
        } = options;

        let sql;
        const dialect = sequelize.getDialect();

        switch (dialect) {
            case 'postgres':
                sql = `
                    SELECT 
                        column_name, 
                        data_type,
                        character_maximum_length,
                        column_default,
                        is_nullable
                    FROM information_schema.columns 
                    WHERE table_schema = :schema
                    ${tableName ? 'AND table_name = :tableName' : ''}
                    ORDER BY ordinal_position;
                `;
                break;

            case 'mysql':
                sql = `
                    SELECT 
                        COLUMN_NAME as column_name,
                        DATA_TYPE as data_type,
                        CHARACTER_MAXIMUM_LENGTH as character_maximum_length,
                        COLUMN_DEFAULT as column_default,
                        IS_NULLABLE as is_nullable
                    FROM information_schema.columns 
                    WHERE table_schema = DATABASE()
                    ${tableName ? 'AND table_name = :tableName' : ''}
                    ORDER BY ORDINAL_POSITION;
                `;
                break;

            case 'sqlite':
                if (tableName) {
                    sql = `PRAGMA table_info(:tableName);`;
                } else {
                    sql = `SELECT name FROM sqlite_master WHERE type='table';`;
                }
                break;

            default:
                throw new Error(`Unsupported dialect: ${dialect}`);
        }

        const replacements = {
            schema,
            ...(tableName && { tableName })
        };

        const result = await sequelize.query(sql, {
            replacements,
            type: QueryTypes.SELECT,
            raw
        });

        if (dialect === 'sqlite' && !tableName) {
            // For SQLite, when no specific table is requested, get structure for all tables
            const allTables = {};
            for (const table of result) {
                const tableInfo = await sequelize.query(`PRAGMA table_info('${table.name}');`, {
                    type: QueryTypes.SELECT,
                    raw
                });
                allTables[table.name] = tableInfo;
            }
            return allTables;
        }

        return result;
    } catch (error) {
        logger.error('Error getting table structure:', error);
        return null;
    }
}

/**
 * Get all tables in the database
 * @param {Sequelize} sequelize - Sequelize instance
 * @param {Object} options - Options for getting tables
 * @returns {Promise<Array>} List of tables
 */
async function getAllTables(sequelize, options = {}) {
    try {
        const {
            schema = 'public',
            raw = true
        } = options;

        const dialect = sequelize.getDialect();
        let sql;

        switch (dialect) {
            case 'postgres':
                sql = `
                    SELECT 
                        table_name,
                        table_type
                    FROM information_schema.tables 
                    WHERE table_schema = :schema
                    ORDER BY table_name;
                `;
                break;

            case 'mysql':
                sql = `
                    SELECT 
                        TABLE_NAME as table_name,
                        TABLE_TYPE as table_type
                    FROM information_schema.tables 
                    WHERE table_schema = DATABASE()
                    ORDER BY table_name;
                `;
                break;

            case 'sqlite':
                sql = `
                    SELECT 
                        name as table_name,
                        type as table_type
                    FROM sqlite_master 
                    WHERE type='table'
                    ORDER BY name;
                `;
                break;

            default:
                throw new Error(`Unsupported dialect: ${dialect}`);
        }

        const result = await sequelize.query(sql, {
            replacements: { schema },
            type: QueryTypes.SELECT,
            raw
        });

        return result;
    } catch (error) {
        logger.error('Error getting all tables:', error);
        return [];
    }
}

/**
 * Get complete database structure including all tables and their columns
 * @param {Sequelize} sequelize - Sequelize instance
 * @param {Object} options - Options for getting database structure
 * @returns {Promise<Object>} Complete database structure
 */
async function getDataStructure(sequelize, options = {}) {
    try {
        const {
            schema = 'public',
            raw = true
        } = options;

        const tables = await getAllTables(sequelize, { schema, raw });
        const structure = {};

        for (const table of tables) {
            const tableName = table.table_name;
            const tableStructure = await getTableStructure(sequelize, {
                tableName,
                schema,
                raw
            });
            
            structure[tableName] = {
                type: table.table_type,
                columns: tableStructure
            };
        }

        return structure;
    } catch (error) {
        logger.error('Error getting database structure:', error);
        return null;
    }
}

module.exports = {
    getTableStructure,
    getAllTables,
    getDataStructure
};