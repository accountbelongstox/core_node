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

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const logger = require('#@logger');
const {
    getTypeConverter,
    TYPE_NUMBER,
    TYPE_INTEGER,
    TYPE_FLOAT,
    TYPE_BOOLEAN,
    TYPE_DATE,
    TYPE_DATETIME,
    TYPE_JSON,
    TYPE_STRING
} = require('./type_converter.js');

const IDENTIFIER_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;
const DEFAULT_BATCH_SIZE = 500;
const SQLITE_TYPE_MAP = new Map([
    ['integer', 'BIGINT'],
    ['int', 'INT'],
    ['tinyint', 'TINYINT'],
    ['smallint', 'SMALLINT'],
    ['bigint', 'BIGINT'],
    ['mediumint', 'INT'],
    ['real', 'DOUBLE'],
    ['double', 'DOUBLE'],
    ['float', 'DOUBLE'],
    ['numeric', 'DECIMAL(20,6)'],
    ['decimal', 'DECIMAL(20,6)'],
    ['boolean', 'TINYINT(1)'],
    ['bool', 'TINYINT(1)'],
    ['date', 'DATE'],
    ['datetime', 'DATETIME'],
    ['timestamp', 'DATETIME'],
    ['text', 'TEXT'],
    ['clob', 'TEXT'],
    ['varchar', 'VARCHAR(255)'],
    ['char', 'CHAR(255)'],
    ['blob', 'BLOB']
]);

function quoteIdentifier(identifier) {
    if (!identifier) {
        throw new Error('Identifier is required');
    }
    if (IDENTIFIER_REGEX.test(identifier)) {
        return `\`${identifier}\``;
    }
    return `\`${identifier.replace(/`/g, '``')}\``;
}

function resolveMysqlColumnType(sqliteType = '') {
    const normalized = String(sqliteType).trim().toLowerCase();
    if (!normalized) {
        return 'TEXT';
    }
    for (const [candidate, mysqlType] of SQLITE_TYPE_MAP.entries()) {
        if (normalized.includes(candidate)) {
            return mysqlType;
        }
    }
    return 'TEXT';
}

function resolveConverterType(sqliteType = '') {
    const normalized = String(sqliteType).trim().toLowerCase();
    if (normalized.includes('int')) {
        return TYPE_INTEGER;
    }
    if (normalized.includes('real') || normalized.includes('double') || normalized.includes('float') || normalized.includes('decimal')) {
        return TYPE_FLOAT;
    }
    if (normalized.includes('bool')) {
        return TYPE_BOOLEAN;
    }
    if (normalized.includes('date') && !normalized.includes('datetime')) {
        return TYPE_DATE;
    }
    if (normalized.includes('datetime') || normalized.includes('timestamp')) {
        return TYPE_DATETIME;
    }
    if (normalized.includes('json')) {
        return TYPE_JSON;
    }
    if (normalized.includes('num')) {
        return TYPE_NUMBER;
    }
    return TYPE_STRING;
}

function mapSchemaColumns(columns, typeOverrides = {}) {
    const primaryKeys = columns.filter((column) => column.pk === 1);
    const singlePrimaryKey = primaryKeys.length === 1 ? primaryKeys[0] : null;
    return columns.map((column) => {
        const normalizedName = column.name;
        const override = typeOverrides[normalizedName] || {};
        const sqliteType = override.sqliteType || column.type;
        const mysqlType = override.mysqlType || resolveMysqlColumnType(sqliteType);
        const converterType = override.converterType || resolveConverterType(sqliteType);
        const shouldAutoIncrement = Boolean(
            override.autoIncrement || (
                singlePrimaryKey &&
                singlePrimaryKey.name === normalizedName &&
                /int/i.test(sqliteType || '')
            )
        );
        return {
            name: normalizedName,
            sqliteType,
            mysqlType,
            converterType,
            notNull: column.notnull === 1 || override.notNull === true,
            primaryKey: column.pk === 1 || override.primaryKey === true,
            defaultValue: override.defaultValue !== undefined ? override.defaultValue : column.dflt_value,
            autoIncrement: shouldAutoIncrement
        };
    });
}

class SqliteToMysqlMigrator {
    constructor(options = {}) {
        this.sqlitePath = options.sqlitePath;
        this.mysqlConfig = options.mysqlConfig || {};
        this.logger = options.logger || logger;
        this.batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
        this.typeConverter = options.typeConverter || getTypeConverter();
        this.tableFilter = options.tableFilter;
        this.sqliteDb = null;
        this.mysqlPool = null;
    }

    async initialize() {
        if (!this.sqlitePath) {
            throw new Error('sqlitePath is required');
        }
        if (!this.mysqlConfig || !this.mysqlConfig.host) {
            throw new Error('mysqlConfig.host is required');
        }
        await this.openSqlite();
        await this.createMysqlPool();
        this.logger.info(`SqliteToMysqlMigrator initialized (sqlite: ${path.basename(this.sqlitePath)})`);
    }

    async close() {
        if (this.sqliteDb) {
            await new Promise((resolve) => this.sqliteDb.close(resolve));
            this.sqliteDb = null;
        }
        if (this.mysqlPool) {
            await this.mysqlPool.end();
            this.mysqlPool = null;
        }
    }

    async openSqlite() {
        this.sqliteDb = await new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.sqlitePath, sqlite3.OPEN_READONLY, (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(db);
            });
        });
    }

    async createMysqlPool() {
        this.mysqlPool = mysql.createPool({
            ...this.mysqlConfig,
            waitForConnections: true,
            connectionLimit: this.mysqlConfig.connectionLimit || 5,
            queueLimit: 0,
            namedPlaceholders: true
        });
    }

    async querySqlite(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.sqliteDb.all(sql, params, (error, rows) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(rows || []);
            });
        });
    }

    async queryMysql(sql, params = []) {
        const connection = await this.mysqlPool.getConnection();
        try {
            const [result] = await connection.query(sql, params);
            return result;
        } finally {
            connection.release();
        }
    }

    async getSqliteTables() {
        const tables = await this.querySqlite(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        );
        return tables.map((row) => row.name);
    }

    async getSqliteTableSchema(tableName) {
        const escapedName = tableName.replace(/'/g, "''");
        const columns = await this.querySqlite(`PRAGMA table_info('${escapedName}')`);
        return columns;
    }

    buildCreateTableSql(tableName, mappedColumns, options = {}) {
        const columnDefinitions = mappedColumns.map((column) => {
            const parts = [quoteIdentifier(column.name), column.mysqlType];
            if (column.notNull) {
                parts.push('NOT NULL');
            }
            if (column.autoIncrement) {
                parts.push('AUTO_INCREMENT');
            }
            if (column.defaultValue !== null && column.defaultValue !== undefined) {
                parts.push('DEFAULT ?');
            }
            return {
                sql: parts.join(' '),
                defaultValue: column.defaultValue
            };
        });

        const primaryKeys = mappedColumns.filter((column) => column.primaryKey).map((column) => quoteIdentifier(column.name));
        const sqlFragments = columnDefinitions.map((item) => item.sql);
        if (primaryKeys.length > 0) {
            sqlFragments.push(`PRIMARY KEY (${primaryKeys.join(', ')})`);
        }

        const createSql = `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(tableName)} (${sqlFragments.join(', ')}) ENGINE=${options.engine || 'InnoDB'} DEFAULT CHARSET=${options.charset || 'utf8mb4'}`;
        const parameters = columnDefinitions
            .filter((item) => item.defaultValue !== null && item.defaultValue !== undefined)
            .map((item) => item.defaultValue);

        return { sql: createSql, parameters };
    }

    buildInsertStatement(tableName, columns, rows) {
        const columnNames = columns.map((column) => quoteIdentifier(column.name));
        const placeholders = `(${columns.map(() => '?').join(', ')})`;
        const values = [];
        const rowsSql = rows
            .map((row) => {
                columns.forEach((column) => {
                    values.push(row[column.name]);
                });
                return placeholders;
            })
            .join(', ');
        const sql = `INSERT INTO ${quoteIdentifier(tableName)} (${columnNames.join(', ')}) VALUES ${rowsSql}`;
        return { sql, values };
    }

    async ensureTargetTable(tableName, mappedColumns, options = {}) {
        if (options.skipTableCreation) {
            return;
        }
        const { sql, parameters } = this.buildCreateTableSql(tableName, mappedColumns, options.tableOptions);
        if (parameters.length > 0) {
            await this.queryMysql(sql, parameters);
            return;
        }
        await this.queryMysql(sql);
    }

    async fetchSqliteBatch(tableName, offset, limit, whereClause) {
        const baseQuery = [`SELECT * FROM ${quoteIdentifier(tableName)}`];
        if (whereClause && whereClause.trim().length > 0) {
            baseQuery.push(`WHERE ${whereClause}`);
        }
        baseQuery.push('LIMIT ? OFFSET ?');
        const sql = baseQuery.join(' ');
        const rows = await this.querySqlite(sql, [limit, offset]);
        return rows;
    }

    async migrateTable(tableName, options = {}) {
        const targetTableName = options.targetTable || tableName;
        const typeOverrides = options.typeOverrides || {};
        const whereClause = options.where || '';
        const beforeInsert = options.beforeInsert;
        const truncateTarget = options.truncate === true;

        const sqliteSchema = await this.getSqliteTableSchema(tableName);
        const mappedColumns = mapSchemaColumns(sqliteSchema, typeOverrides);
        const converterSchema = mappedColumns.reduce((accumulator, column) => {
            accumulator[column.name] = { type: column.converterType };
            return accumulator;
        }, {});

        await this.ensureTargetTable(targetTableName, mappedColumns, options);

        if (truncateTarget) {
            await this.queryMysql(`TRUNCATE TABLE ${quoteIdentifier(targetTableName)}`);
        }

        let offset = 0;
        let migratedRows = 0;
        let hasMore = true;

        while (hasMore) {
            const batch = await this.fetchSqliteBatch(tableName, offset, this.batchSize, whereClause);
            if (!batch.length) {
                hasMore = false;
                break;
            }
            const convertedRows = batch.map((row) => this.typeConverter.convertRowWithFallback(row, converterSchema));
            const processedRows = beforeInsert ? convertedRows.map((row) => beforeInsert(row) || row) : convertedRows;
            const { sql, values } = this.buildInsertStatement(targetTableName, mappedColumns, processedRows);
            await this.queryMysql(sql, values);
            offset += batch.length;
            migratedRows += batch.length;
            this.logger.info(`Migrated ${migratedRows} rows into ${targetTableName}`);
        }

        return {
            table: tableName,
            targetTable: targetTableName,
            rows: migratedRows
        };
    }

    async migrateAll(options = {}) {
        await this.initialize();
        try {
            const tables = await this.getSqliteTables();
            const filteredTables = typeof this.tableFilter === 'function' ? tables.filter(this.tableFilter) : tables;
            const results = [];
            for (const table of filteredTables) {
                const tableOptions = options.tables && options.tables[table] ? options.tables[table] : {};
                const result = await this.migrateTable(table, tableOptions);
                results.push(result);
            }
            return results;
        } finally {
            await this.close();
        }
    }
}

module.exports = {
    SqliteToMysqlMigrator
};
