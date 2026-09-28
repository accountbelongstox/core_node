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