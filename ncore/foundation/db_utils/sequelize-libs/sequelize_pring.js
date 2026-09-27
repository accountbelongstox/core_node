const { Sequelize } = require('sequelize');
const logger = require('#@logger');
const { isDebug } = require('../../common/logger.js')
const printedDatabases = {};

async function printTableStructure(sequelize, tableName, dbName) {
    if (!isDebug) return;
    if (!printedDatabases[dbName]) {
        printedDatabases[dbName] = {};
    }
    if (printedDatabases[dbName][tableName]) {
        logger.debug(`Database ${dbName} structure already printed`);
        return
    }
    const tables = await sequelize.getQueryInterface().showAllTables();
    console.log('dbName',dbName,'Available tables:', tables);

    try {
        const tableInfo = await sequelize.getQueryInterface().describeTable(tableName);
        const maxFieldLength = Math.max(...Object.keys(tableInfo).map(field => field.length), 5);
        const maxTypeLength = Math.max(...Object.values(tableInfo).map(info => info.type.toString().length), 4);
        const separator = '─'.repeat(maxFieldLength + maxTypeLength + 24);
        console.log(`┌${separator}┐`);
        console.log(`│ Database: ${dbName.padEnd(separator.length - 11)} │`);
        console.log(`├${separator}┤`);
        console.log(`│ Table: ${tableName.padEnd(separator.length - 8)} │`);
        console.log(`├${separator}┤`);
        console.log(`│ ${'Field'.padEnd(maxFieldLength)} │ ${'Type'.padEnd(maxTypeLength)} │ Null │ Key │`);
        console.log(`├${separator}┤`);
        for (const [field, info] of Object.entries(tableInfo)) {
            const type = info.type.toString();
            const nullable = info.allowNull ? 'YES' : 'NO ';
            const key = info.primaryKey ? 'PRI' : info.unique ? 'UNI' : '   ';
            console.log(
                `│ ${field.padEnd(maxFieldLength)} │ ${type.padEnd(maxTypeLength)} │ ${nullable} │ ${key} │`
            );
        }
        console.log(`└${separator}┘\n`);
        printedDatabases[dbName][tableName] = true;
    } catch (error) {
        logger.error('Error printing table structure:', error);
    }
}

module.exports = {
    printTableStructure
}; 