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

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const logger = require('#@logger');
const ExitOn = require('#@exiton');
const { APP_METADATA_SQLITE_DIR } = require('#@global_dir');
const { DataTypes } = require('./data_types');
const { buildWhereClause, buildOrder, encodeValue, decodeRow } = require('./query_builder');

const MEMORY_DATABASES = new Map();
const PERSIST_INTERVAL_MS = 5000;
let persistTimer = null;

const IDENTIFIER_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quoteIdentifier(value) {
    if (typeof value !== 'string') {
        return value;
    }
    if (!IDENTIFIER_REGEX.test(value)) {
        return value;
    }
    return `"${value}"`;
}

async function beginImmediate(db) {
    await run(db, 'BEGIN IMMEDIATE TRANSACTION');
}

function createTransactionFacade(dbState) {
    const facade = {
        __dbState: dbState,
        async transaction(handler) {
            const transaction = await createTransaction(dbState);
            if (typeof handler === 'function') {
                try {
                    const result = await handler(transaction);
                    await transaction.commit();
                    return result;
                } catch (error) {
                    await transaction.rollback();
                    throw error;
                }
            }
            return transaction;
        },
        async close() {
            await closeDatabase(dbState.dbName);
        },
        async sync() {
            return true;
        },
        get config() {
            return { dialect: 'sqlite' };
        },
        get options() {
            return { dialect: 'sqlite' };
        },
        get models() {
            return dbState.models;
        }
    };
    return facade;
}

async function createTransaction(dbState) {
    await beginImmediate(dbState.db);
    let active = true;
    let dirty = false;
    return {
        __dbState: dbState,
        __isMemoryTransaction: true,
        markDirty() {
            dirty = true;
        },
        async commit() {
            if (!active) {
                return;
            }
            try {
                await run(dbState.db, 'COMMIT');
                if (dirty) {
                    dbState.dirty = true;
                    dbState.lastPersistedAt = Date.now();
                }
            } finally {
                active = false;
            }
        },
        async rollback() {
            if (!active) {
                return;
            }
            try {
                await run(dbState.db, 'ROLLBACK');
            } finally {
                active = false;
                dirty = false;
            }
        }
    };
}

function isActiveTransaction(transaction, dbState) {
    if (!transaction || !transaction.__isMemoryTransaction) {
        return false;
    }
    return transaction.__dbState === dbState;
}

function markDirty(dbState, transaction) {
    if (transaction && isActiveTransaction(transaction, dbState)) {
        transaction.markDirty();
        return;
    }
    dbState.dirty = true;
    dbState.lastPersistedAt = Date.now();
}

function ensurePersistDirectory() {
    if (!fs.existsSync(APP_METADATA_SQLITE_DIR)) {
        fs.mkdirSync(APP_METADATA_SQLITE_DIR, { recursive: true });
    }
}

function resolveDatabasePath(dbNameOrPath) {
    const isAbsolute = path.isAbsolute(dbNameOrPath);
    const fileName = isAbsolute ? dbNameOrPath : path.join(APP_METADATA_SQLITE_DIR, `${dbNameOrPath}.sqlite`);
    const dbName = path.basename(fileName, path.extname(fileName));
    return {
        fileName,
        dbName
    };
}

function buildMemoryUri(dbName) {
    const safeName = encodeURIComponent(dbName);
    return `file:${safeName}?mode=memory&cache=shared`;
}

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function runCallback(error) {
            if (error) {
                reject(error);
                return;
            }
            resolve(this);
        });
    });
}

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(rows);
        });
    });
}

function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(row);
        });
    });
}

async function createTable(dbState, tableName, definition) {
    const columnFragments = [];
    const primaryKeys = [];
    const columns = {};
    for (const [columnName, columnDefinition] of Object.entries(definition)) {
        const columnType = columnDefinition.type || DataTypes.TEXT;
        const fragmentParts = [quoteIdentifier(columnName), columnType.toSql()];

        if (columnDefinition.primaryKey) {
            primaryKeys.push(columnName);
        }
        if (columnDefinition.autoIncrement) {
            fragmentParts.push('PRIMARY KEY AUTOINCREMENT');
        }
        if (columnDefinition.allowNull === false) {
            fragmentParts.push('NOT NULL');
        }
        if (columnDefinition.unique) {
            fragmentParts.push('UNIQUE');
        }
        if (columnDefinition.defaultValue !== undefined && columnDefinition.defaultValue !== null) {
            if (columnDefinition.defaultValue === DataTypes.NOW) {
                fragmentParts.push('DEFAULT CURRENT_TIMESTAMP');
            } else {
                const defaultLiteral = encodeValue(columnDefinition, columnDefinition.defaultValue);
                if (typeof defaultLiteral === 'number') {
                    fragmentParts.push(`DEFAULT ${defaultLiteral}`);
                } else if (defaultLiteral === null) {
                    fragmentParts.push('DEFAULT NULL');
                } else {
                    const escaped = String(defaultLiteral).replace(/'/g, "''");
                    fragmentParts.push(`DEFAULT '${escaped}'`);
                }
            }
        }
        columnFragments.push({
            sql: fragmentParts.join(' '),
            columnDefinition
        });
        columns[columnName] = columnDefinition;
    }

    let createSql = `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(tableName)} (${columnFragments.map((item) => item.sql).join(', ')}`;
    if (primaryKeys.length > 0 && !definition[primaryKeys[0]].autoIncrement) {
        createSql += `, PRIMARY KEY (${primaryKeys.map((name) => quoteIdentifier(name)).join(', ')})`;
    }
    createSql += ')';

    await run(dbState.db, createSql);
    dbState.columns[tableName] = columns;
}

async function copySchemaFromDisk(memoryDb, diskFilePath) {
    return new Promise((resolve, reject) => {
        memoryDb.serialize(() => {
            memoryDb.run(`ATTACH DATABASE ? AS disk_source`, [diskFilePath], (attachErr) => {
                if (attachErr) {
                    logger.error(`Failed attaching disk database ${diskFilePath}:`, attachErr);
                    memoryDb.run('DETACH DATABASE disk_source', () => resolve());
                    return;
                }

                memoryDb.all(`SELECT name, type, sql FROM disk_source.sqlite_master WHERE sql NOT NULL AND name NOT LIKE 'sqlite_%'`, [], (err, rows) => {
                    if (err) {
                        logger.error(`Failed reading schema from ${diskFilePath}:`, err);
                        memoryDb.run('DETACH DATABASE disk_source', () => resolve());
                        return;
                    }

                    const tableNames = [];
                    for (const row of rows) {
                        if (row.type === 'table') {
                            tableNames.push(row.name);
                        }
                        if (row.sql) {
                            memoryDb.run(row.sql, (createErr) => {
                                if (createErr) {
                                    logger.warn(`Skipping creation for ${row.name}: ${createErr.message}`);
                                }
                            });
                        }
                    }

                    const copyNextTable = (index) => {
                        if (index >= tableNames.length) {
                            memoryDb.run('DETACH DATABASE disk_source', (detachErr) => {
                                if (detachErr) {
                                    logger.warn(`Failed detaching disk_source: ${detachErr.message}`);
                                }
                                resolve();
                            });
                            return;
                        }
                        const table = tableNames[index];
                        memoryDb.run(`INSERT INTO "${table}" SELECT * FROM disk_source."${table}"`, [], (copyErr) => {
                            if (copyErr) {
                                logger.warn(`Failed copying table ${table}: ${copyErr.message}`);
                            }
                            copyNextTable(index + 1);
                        });
                    };

                    copyNextTable(0);
                });
            });
        });
    });
}

async function persistDatabase(dbState) {
    if (!dbState.dirty) {
        return;
    }
    const targetPath = dbState.fileName;
    const escaped = targetPath.replace(/'/g, "''");
    try {
        await run(dbState.db, `VACUUM INTO '${escaped}'`);
        dbState.dirty = false;
        dbState.lastPersistedAt = Date.now();
    } catch (error) {
        logger.error(`Failed persisting database ${dbState.dbName}:`, error);
    }
}

function ensurePersistTimer() {
    if (persistTimer) {
        return;
    }
    persistTimer = setInterval(() => {
        MEMORY_DATABASES.forEach((dbState) => {
            persistDatabase(dbState).catch((error) => {
                logger.error(`Persistence error for ${dbState.dbName}:`, error);
            });
        });
    }, PERSIST_INTERVAL_MS).unref();
}

async function initializeDatabase(dbNameOrPath, modelDefinition, options = {}) {
    ensurePersistDirectory();
    ensurePersistTimer();
    const { fileName, dbName } = resolveDatabasePath(dbNameOrPath);
    if (MEMORY_DATABASES.has(dbName)) {
        const existing = MEMORY_DATABASES.get(dbName);
        if (modelDefinition) {
            await registerModels(existing, modelDefinition, options);
        }
        return existing;
    }

    const memoryUri = buildMemoryUri(dbName);
    const db = new sqlite3.Database(memoryUri, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE | sqlite3.OPEN_URI);

    const dbState = {
        db,
        dbName,
        fileName,
        columns: {},
        models: {},
        sequelize: null,
        lastPersistedAt: Date.now(),
        dirty: false
    };

    MEMORY_DATABASES.set(dbName, dbState);
    dbState.sequelize = createTransactionFacade(dbState);

    if (fs.existsSync(fileName)) {
        try {
            await copySchemaFromDisk(dbState.db, fileName);
        } catch (error) {
            logger.error(`Failed loading existing database ${fileName}:`, error);
        }
    }

    if (modelDefinition) {
        await registerModels(dbState, modelDefinition, options);
    }

    return dbState;
}

async function registerModels(dbState, modelDefinition, options = {}) {
    const tableModels = {};
    for (const [tableName, definition] of Object.entries(modelDefinition || {})) {
        await createTable(dbState, tableName, definition);
        tableModels[tableName] = createModel(dbState, tableName, definition);
    }
    dbState.models = {
        ...dbState.models,
        ...tableModels
    };
    dbState.dirty = true;
    return tableModels;
}

function createModel(dbState, tableName, definition) {
    const model = {
        tableName,
        definition,
        databaseHandle: dbState.sequelize,
        __dbState: dbState,
        sequelize: dbState.sequelize,
        name: tableName,
        primaryKeyAttributes: Object.entries(definition)
            .filter(([, column]) => column.primaryKey)
            .map(([columnName]) => columnName),
        rawAttributes: definition,
        create: async (data, options = {}) => {
            await insertRows(dbState, tableName, Array.isArray(data) ? data : [data], options);
            return data;
        },
        bulkCreate: async (records, options = {}) => {
            if (!Array.isArray(records)) {
                throw new Error('bulkCreate expects an array of records');
            }
            await insertRows(dbState, tableName, records, options);
            return records;
        },
        update: async (values, options = {}) => {
            const where = options.where || {};
            const result = await updateRows(dbState, tableName, where, values, options);
            return [result.count];
        },
        destroy: async (options = {}) => {
            const where = options.where || {};
            const force = options.force === true;
            const result = await deleteRows(dbState, tableName, where, { soft: !force });
            return result.count;
        },
        findAll: async (options = {}) => {
            return queryRows(dbState, tableName, options);
        },
        findOne: async (options = {}) => {
            const rows = await queryRows(dbState, tableName, { ...options, limit: 1, plain: true });
            return rows ?? null;
        },
        findByPk: async (primaryKey, options = {}) => {
            if (!model.primaryKeyAttributes || model.primaryKeyAttributes.length === 0) {
                return null;
            }
            const where = {
                [model.primaryKeyAttributes[0]]: primaryKey
            };
            return model.findOne({ ...options, where });
        },
        count: async (options = {}) => {
            const where = options.where || {};
            return countRows(dbState, tableName, where);
        }
    };
    return model;
}

async function insertRows(dbState, tableName, rows, options = {}) {
    if (!rows.length) {
        return;
    }
    const columns = dbState.columns[tableName];
    const fields = Object.keys(columns);
    const filteredFields = fields.filter((field) => {
        const definition = columns[field];
        if (definition.autoIncrement) {
            return false;
        }
        return true;
    });
    const placeholders = `(${filteredFields.map(() => '?').join(', ')})`;
    const sql = `INSERT INTO ${quoteIdentifier(tableName)} (${filteredFields.map((name) => quoteIdentifier(name)).join(', ')}) VALUES ${placeholders}`;

    const transaction = options.transaction;
    const useExistingTransaction = isActiveTransaction(transaction, dbState);
    if (!useExistingTransaction) {
        await beginImmediate(dbState.db);
    }
    try {
        for (const row of rows) {
            const params = filteredFields.map((field) => encodeValue(columns[field], row[field] ?? columns[field]?.defaultValue ?? null));
            await run(dbState.db, sql, params);
        }
        if (useExistingTransaction) {
            transaction.markDirty();
        } else {
            await run(dbState.db, 'COMMIT');
            markDirty(dbState);
        }
    } catch (error) {
        if (!useExistingTransaction) {
            await run(dbState.db, 'ROLLBACK').catch(() => null);
        }
        throw error;
    }
}

async function updateRows(dbState, tableName, where, values, options = {}) {
    if (!where || Object.keys(where).length === 0) {
        throw new Error('Where condition is required for update');
    }
    const columns = dbState.columns[tableName];
    const setFragments = [];
    const params = [];
    for (const [field, value] of Object.entries(values)) {
        setFragments.push(`${quoteIdentifier(field)} = ?`);
        params.push(encodeValue(columns[field], value));
    }
    const whereResult = buildWhereClause(where, columns);
    const sql = `UPDATE ${quoteIdentifier(tableName)} SET ${setFragments.join(', ')} WHERE ${whereResult.clause}`;
    const transaction = options.transaction;
    const useExistingTransaction = isActiveTransaction(transaction, dbState);
    if (!useExistingTransaction) {
        await beginImmediate(dbState.db);
    }
    try {
        const statement = await run(dbState.db, sql, params.concat(whereResult.params));
        if (useExistingTransaction) {
            transaction.markDirty();
        } else {
            await run(dbState.db, 'COMMIT');
            markDirty(dbState);
        }
        return {
            success: true,
            count: Number(statement.changes) || 0
        };
    } catch (error) {
        if (!useExistingTransaction) {
            await run(dbState.db, 'ROLLBACK').catch(() => null);
        }
        throw error;
    }
}

async function deleteRows(dbState, tableName, where, options = {}) {
    const columns = dbState.columns[tableName];
    const whereResult = buildWhereClause(where, columns);
    if (!whereResult.clause) {
        throw new Error('Where condition is required for delete');
    }
    const canSoftDelete = options.soft && columns.deleted_at;
    const sql = canSoftDelete
        ? `UPDATE ${quoteIdentifier(tableName)} SET deleted_at = CURRENT_TIMESTAMP WHERE ${whereResult.clause}`
        : `DELETE FROM ${quoteIdentifier(tableName)} WHERE ${whereResult.clause}`;
    const transaction = options.transaction;
    const useExistingTransaction = isActiveTransaction(transaction, dbState);
    if (!useExistingTransaction) {
        await beginImmediate(dbState.db);
    }
    try {
        const statement = await run(dbState.db, sql, whereResult.params);
        if (useExistingTransaction) {
            transaction.markDirty();
        } else {
            await run(dbState.db, 'COMMIT');
            markDirty(dbState);
        }
        return {
            success: true,
            count: Number(statement.changes) || 0
        };
    } catch (error) {
        if (!useExistingTransaction) {
            await run(dbState.db, 'ROLLBACK').catch(() => null);
        }
        throw error;
    }
}

async function queryRows(dbState, tableName, options = {}) {
    const columns = dbState.columns[tableName];
    const attributes = options.attributes && options.attributes.length ? options.attributes : Object.keys(columns);
    const selectFields = attributes.map((field) => quoteIdentifier(field)).join(', ');
    const whereResult = buildWhereClause(options.where || {}, columns);
    let sql = `SELECT ${selectFields} FROM ${quoteIdentifier(tableName)}`;
    if (whereResult.clause) {
        sql += ` WHERE ${whereResult.clause}`;
    }
    sql += buildOrder(options.order);
    if (options.limit) {
        sql += ` LIMIT ${Number(options.limit)}`;
    }
    if (options.offset) {
        sql += ` OFFSET ${Number(options.offset)}`;
    }
    const rows = await all(dbState.db, sql, whereResult.params);
    const decoded = rows.map((row) => decodeRow(columns, row));
    if (options.plain) {
        return decoded[0] ?? null;
    }
    return decoded;
}

async function countRows(dbState, tableName, where = {}) {
    const columns = dbState.columns[tableName];
    const whereResult = buildWhereClause(where, columns);
    let sql = `SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)}`;
    if (whereResult.clause) {
        sql += ` WHERE ${whereResult.clause}`;
    }
    const row = await get(dbState.db, sql, whereResult.params);
    return Number(row?.count) || 0;
}

async function queryDatabaseStructure(dbState) {
    const tables = await all(dbState.db, `SELECT name, type FROM sqlite_master WHERE type='table' ORDER BY name`);
    const structure = {};
    for (const table of tables) {
        const columns = await all(dbState.db, `PRAGMA table_info('${table.name}')`);
        structure[table.name] = columns;
    }
    return structure;
}

async function queryTableStructure(dbState, tableName) {
    const columns = await all(dbState.db, `PRAGMA table_info('${tableName}')`);
    return columns;
}

async function closeDatabase(dbName) {
    const dbState = MEMORY_DATABASES.get(dbName);
    if (!dbState) {
        return;
    }
    await new Promise((resolve) => {
        dbState.db.close((error) => {
            if (error) {
                logger.error(`Closing database ${dbName} failed:`, error);
            }
            resolve();
        });
    });
    MEMORY_DATABASES.delete(dbName);
}

async function closeAllDatabases() {
    const closures = [];
    MEMORY_DATABASES.forEach((_, dbName) => {
        closures.push(closeDatabase(dbName));
    });
    await Promise.allSettled(closures);
    MEMORY_DATABASES.clear();
}

async function destroyDatabase(dbName) {
    await closeDatabase(dbName);
    const fileName = path.join(APP_METADATA_SQLITE_DIR, `${dbName}.sqlite`);
    if (fs.existsSync(fileName)) {
        try {
            fs.unlinkSync(fileName);
        } catch (error) {
            logger.warn(`Failed removing database file ${fileName}: ${error.message}`);
        }
    }
}

ExitOn.addShutdownHandler(closeAllDatabases);

module.exports = {
    initializeDatabase,
    registerModels,
    createModel,
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
};
