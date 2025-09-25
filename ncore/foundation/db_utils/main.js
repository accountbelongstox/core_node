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

// const { SQLite } = require('./libs/sqlite.js');
const {
    obtainInstantiationSequelize,
    defineSequelizeModelByDefinition,
    getDatabase,
    closeDatabase,
    closeAllDatabases
} = require('./sequelize_db.js');

const {
    dbInsert,
    dbInsertSingle,
    dbInsertBulk
} = require('./sequelize-oporate/sequelize_insert.js');

const {
    dbUpdate
} = require('./sequelize-oporate/sequelize_update.js');

const {
    dbSoftDelete,
    dbHardDelete
} = require('./sequelize-oporate/sequelize_delete.js');

const {
    dbQuery,
    dbQueryCount
} = require('./sequelize-oporate/sequelize_query.js');
const {
    getTableStructure,
    getAllTables,
    getDataStructure
} = require('./sequelize-oporate/sequelize_table.js');


module.exports = {
    obtainInstantiationSequelize,
    getTableStructure,
    getAllTables,
    getDataStructure,
    defineSequelizeModelByDefinition,
    getDatabase,
    closeDatabase,
    closeAllDatabases,
    dbInsert,
    dbInsertSingle,
    dbInsertBulk,
    dbUpdate,
    dbSoftDelete,
    dbHardDelete,
    dbQuery,
    dbQueryCount
};