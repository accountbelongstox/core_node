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

const { Sequelize } = require('sequelize');
const logger = require('#@logger');
const { isDebug } = require('#@global_vars')
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