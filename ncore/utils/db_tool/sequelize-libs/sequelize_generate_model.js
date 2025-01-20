const { Sequelize } = require('sequelize');
const logger = require('#@logger');
const fs = require('fs');
const path = require('path');

/**
 * Generate model code from database table structure
 * @param {Sequelize} sequelize - Sequelize instance
 * @param {string} [outputPath] - Optional path to save the generated code
 * @returns {Promise<string>} Generated model code
 */
async function generateModelCode(sequelize, outputPath = null) {
    try {
        // Get all tables from database
        const tables = await sequelize.getQueryInterface().showAllTables();
        logger.info('Found tables:', tables);

        let modelCode = `const { DataTypes } = require('#@/ncore/utils/db_tool/sequelize_db.js');\n\n`;
        modelCode += `const sequelize_init_tables = {\n`;

        // Process each table
        for (const tableName of tables) {
            try {
                const tableInfo = await sequelize.getQueryInterface().describeTable(tableName);
                modelCode += `    ${tableName}: {\n`;

                // Get the maximum field name length for alignment
                const maxFieldLength = Math.max(...Object.keys(tableInfo).map(field => field.length));

                // Process each field
                for (const [field, info] of Object.entries(tableInfo)) {
                    const padding = ' '.repeat(maxFieldLength - field.length);
                    let fieldDefinition = `        ${field}:${padding} {\n`;
                    
                    // Add type
                    fieldDefinition += `            type: DataTypes.${getSequelizeType(info.type)},\n`;
                    
                    // Add constraints
                    if (info.primaryKey) {
                        fieldDefinition += `            primaryKey: true,\n`;
                    }
                    if (info.autoIncrement) {
                        fieldDefinition += `            autoIncrement: true,\n`;
                    }
                    if (!info.allowNull) {
                        fieldDefinition += `            allowNull: false,\n`;
                    }
                    if (info.unique) {
                        fieldDefinition += `            unique: true,\n`;
                    }
                    if (info.defaultValue !== undefined && info.defaultValue !== null) {
                        if (info.defaultValue === 'CURRENT_TIMESTAMP') {
                            fieldDefinition += `            defaultValue: DataTypes.NOW,\n`;
                        } else {
                            fieldDefinition += `            defaultValue: ${JSON.stringify(info.defaultValue)},\n`;
                        }
                    }

                    fieldDefinition += `        },\n`;
                    modelCode += fieldDefinition;
                }

                modelCode += `    },\n\n`;
            } catch (error) {
                logger.warn(`Failed to generate model for table ${tableName}:`, error.message);
            }
        }

        modelCode += `};\n\n`;
        modelCode += `module.exports = {\n    sequelize_init_tables\n};\n`;

        // Print the model code
        logger.info('\nGenerated Model Code:');
        logger.info('-------------------------------------------------------------------------------');
        console.log(modelCode);
        logger.info('-------------------------------------------------------------------------------');

        // Save to file if path is provided
        if (outputPath) {
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(outputPath, modelCode);
            logger.success(`Model code saved to: ${outputPath}`);
        }

        return modelCode;
    } catch (error) {
        logger.error('Error generating model code:', error);
        return null;
    }
}

/**
 * Convert database type to Sequelize type
 * @param {string} dbType - Database type
 * @returns {string} Sequelize type
 */
function getSequelizeType(dbType) {
    const typeStr = dbType.toString().toUpperCase();
    
    if (typeStr.includes('VARCHAR') || typeStr.includes('CHARACTER VARYING')) {
        const length = typeStr.match(/\((\d+)\)/);
        return length ? `STRING(${length[1]})` : 'STRING';
    }
    if (typeStr.includes('CHAR')) {
        const length = typeStr.match(/\((\d+)\)/);
        return length ? `CHAR(${length[1]})` : 'CHAR';
    }
    if (typeStr.includes('TEXT')) return 'TEXT';
    if (typeStr.includes('INTEGER')) return 'INTEGER';
    if (typeStr.includes('BIGINT')) return 'BIGINT';
    if (typeStr.includes('FLOAT')) return 'FLOAT';
    if (typeStr.includes('DOUBLE')) return 'DOUBLE';
    if (typeStr.includes('DECIMAL')) return 'DECIMAL';
    if (typeStr.includes('BOOLEAN')) return 'BOOLEAN';
    if (typeStr.includes('DATE')) return 'DATE';
    if (typeStr.includes('TIME')) return 'TIME';
    if (typeStr.includes('DATETIME')) return 'DATE';
    if (typeStr.includes('TIMESTAMP')) return 'DATE';
    if (typeStr.includes('JSON')) return 'JSON';
    if (typeStr.includes('JSONB')) return 'JSONB';
    if (typeStr.includes('BLOB')) return 'BLOB';
    if (typeStr.includes('UUID')) return 'UUID';
    
    return 'STRING'; // Default to STRING if type is unknown
}

module.exports = {
    generateModelCode
};
