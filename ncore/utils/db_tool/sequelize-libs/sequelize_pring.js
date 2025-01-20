const { Sequelize } = require('sequelize');
const logger = require('#@logger');

/**
 * Print the structure of a database table in a formatted way
 * @param {Sequelize} sequelize - Sequelize instance
 * @param {string} tableName - Name of the table to print
 * @param {string} dbName - Optional database name for display
 */
async function printTableStructure(sequelize, tableName = 'contents', dbName) {
    try {
        const tableInfo = await sequelize.getQueryInterface().describeTable(tableName);

        // Get the maximum lengths for formatting
        const maxFieldLength = Math.max(...Object.keys(tableInfo).map(field => field.length));
        const maxTypeLength = Math.max(...Object.values(tableInfo).map(info => info.type.toString().length));

        // Create the header
        const separator = '─'.repeat(maxFieldLength + maxTypeLength + 24);
        logger.success(`\n┌${separator}┐`);
        const dbnamePringStr = dbName ? `dbName: ${dbName}` : '';
        if (dbnamePringStr) logger.success(`│ Table Name: ${dbnamePringStr}`);
        logger.success(`│ Table Structure: ${tableName}${' '.repeat(separator.length - tableName.length - 17)} `);
        logger.success(`├${separator}┤`);
        logger.success(`│ Field${' '.repeat(maxFieldLength - 5)} │ Type${' '.repeat(maxTypeLength - 4)} │ Null │ Key `);
        logger.success(`├${separator}┤`);

        // Print each field
        for (const [field, info] of Object.entries(tableInfo)) {
            const type = info.type.toString();
            const nullable = info.allowNull ? 'YES' : 'NO ';
            const key = info.primaryKey ? 'PRI' : '   ';

            const fieldPadding = ' '.repeat(maxFieldLength - field.length);
            const typePadding = ' '.repeat(maxTypeLength - type.length);

            logger.success(`│ ${field}${fieldPadding} │ ${type}${typePadding} │ ${nullable} │ ${key} `);
        }

        // Close the table
        logger.success(`└${separator}┘\n`);
    } catch (error) {
        logger.error('Error printing table structure:', error);
    }
}

module.exports = {
    printTableStructure
}; 