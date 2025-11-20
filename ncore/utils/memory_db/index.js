// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

'use strict';

const logger = require('#@logger');
const {
    initializeDatabase,
    registerModels,
    insertRows,
    updateRows,
    deleteRows,
    queryRows,
    countRows,
    queryTableStructure,
    queryDatabaseStructure,
    persistDatabase,
    closeDatabase,
    closeAllDatabases,
    destroyDatabase,
    MEMORY_DATABASES
} = require('./database_manager');
const { DataTypes } = require('./data_types');

async function obtainInstantiationSequelize(dbPath, dbName) {
    const dbState = await initializeDatabase(dbPath || dbName, null);
    return dbState.sequelize;
}

async function defineSequelizeModelByDefinition(sequelize, modelDefinition, options = {}, dbName, sync = true) {
    const key = findDatabaseByHandle(sequelize);
    if (!key) {
        throw new Error('Unable to locate database state for provided handle');
    }
    const dbState = MEMORY_DATABASES.get(key);
    if (!dbState) {
        throw new Error(`Database ${key} not initialized`);
    }

    if (typeof modelDefinition === 'string') {
        const tableDefinition = options;
        if (!tableDefinition || typeof tableDefinition !== 'object') {
            throw new Error('Model definition object is required for table registration');
        }
        const created = await registerModels(dbState, { [modelDefinition]: tableDefinition }, {}, sync);
        return created[modelDefinition];
    }

    return registerModels(dbState, modelDefinition, options, sync);
}

function findDatabaseByHandle(dbHandle) {
    let targetKey = null;
    MEMORY_DATABASES.forEach((value, key) => {
        if (value.db === dbHandle || value.sequelize === dbHandle) {
            targetKey = key;
        }
    });
    return targetKey;
}

async function getDatabase(dbNameOrPath, modelDefinition, options = {}) {
    const dbState = await initializeDatabase(dbNameOrPath, modelDefinition, options);
    const tableModels = dbState.models;
    const result = {
        sequelize: dbState.sequelize,
        connection: dbState.db,
        tableModels,
        models: tableModels,
        close: async () => {
            await closeDatabase(dbState.dbName);
        }
    };
    return result;
}

async function dbInsert(sequelize, options = {}) {
    const context = resolveContext(sequelize, options);
    const records = options.data;

    if (!records || (Array.isArray(records) && records.length === 0)) {
        return { success: false, count: 0, error: 'No data provided' };
    }

    const rows = Array.isArray(records) ? records : [records];
    await insertRows(context.dbState, context.tableName, rows, options);
    return { success: true, count: rows.length, data: records };
}

async function dbInsertSingle(sequelize, options = {}) {
    return dbInsert(sequelize, options);
}

async function dbInsertBulk(sequelize, options = {}) {
    return dbInsert(sequelize, options);
}

async function dbUpdate(sequelize, options = {}) {
    const context = resolveContext(sequelize, options);
    const where = options.where || {};
    const data = options.data;
    if (!data) {
        return { success: false, count: 0, error: 'No data provided' };
    }
    if (Array.isArray(data)) {
        let total = 0;
        for (const item of data) {
            const updateResult = await updateRows(context.dbState, context.tableName, item.where || {}, item.data || {}, options);
            total += updateResult.count;
        }
        return { success: true, count: total };
    }
    const result = await updateRows(context.dbState, context.tableName, where, data, options);
    return result;
}

async function dbSoftDelete(sequelize, options = {}) {
    const context = resolveContext(sequelize, options);
    const where = options.where || {};
    const result = await deleteRows(context.dbState, context.tableName, where, {
        soft: true,
        transaction: options.transaction
    });
    return result;
}

async function dbHardDelete(sequelize, options = {}) {
    const context = resolveContext(sequelize, options);
    const where = options.where || {};
    const result = await deleteRows(context.dbState, context.tableName, where, {
        soft: false,
        transaction: options.transaction
    });
    return result;
}

async function dbQuery(sequelize, options = {}) {
    const context = resolveContext(sequelize, options);
    const rows = await queryRows(context.dbState, context.tableName, options);
    return rows;
}

async function dbQueryCount(sequelize, options = {}) {
    const context = resolveContext(sequelize, options);
    const count = await countRows(context.dbState, context.tableName, options.where || {});
    return count;
}

async function getTableStructure(sequelize, options = {}) {
    const context = resolveContext(sequelize, options);
    if (typeof options === 'string') {
        return queryTableStructure(context.dbState, options);
    }
    if (options.tableName) {
        return queryTableStructure(context.dbState, options.tableName);
    }
    return queryDatabaseStructure(context.dbState);
}

async function getAllTables(sequelize) {
    const context = resolveContext(sequelize, {});
    const structure = await queryDatabaseStructure(context.dbState);
    return Object.keys(structure).map((table) => ({
        table_name: table,
        table_type: 'table'
    }));
}

async function getDataStructure(sequelize) {
    const context = resolveContext(sequelize, {});
    return queryDatabaseStructure(context.dbState);
}

function resolveContext(sequelize, options) {
    const models = options.models || {};
    let tableName = options.tableName;
    let model = options.model;
    let dbState = null;

    if (!tableName && model) {
        tableName = model.tableName;
    }
    if (!model && tableName && models[tableName]) {
        model = models[tableName];
    }

    let targetKey = findDatabaseByHandle(sequelize);
    if (!targetKey && model) {
        if (model.__dbState) {
            dbState = model.__dbState;
            targetKey = dbState.dbName;
        } else {
            targetKey = findDatabaseByHandle(model.databaseHandle || model.sequelize);
        }
    }
    if (!targetKey && tableName) {
        MEMORY_DATABASES.forEach((value, key) => {
            if (value.columns[tableName]) {
                targetKey = key;
            }
        });
    }

    if (!targetKey) {
        throw new Error('Cannot resolve database context for operation');
    }
    dbState = dbState || MEMORY_DATABASES.get(targetKey);
    if (!tableName) {
        throw new Error('tableName is required');
    }
    if (!dbState.columns[tableName]) {
        throw new Error(`Table ${tableName} not registered`);
    }
    return {
        dbState,
        tableName,
        model
    };
}

module.exports = {
    obtainInstantiationSequelize,
    defineSequelizeModelByDefinition,
    getDatabase,
    closeDatabase,
    closeAllDatabases,
    destroyDatabase,
    dbInsert,
    dbInsertSingle,
    dbInsertBulk,
    dbUpdate,
    dbSoftDelete,
    dbHardDelete,
    dbQuery,
    dbQueryCount,
    getTableStructure,
    getAllTables,
    getDataStructure,
    DataTypes,
    Model: class MemoryModel {}
};
