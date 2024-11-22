import { Client } from 'pg';
import pgTool from '../utils/pg_tool.js';

class PostgreSQL {
    constructor(configOrDbUrl, initConfigFile = '', debug = false) {
        this.dbUrl = typeof configOrDbUrl === 'string' ? configOrDbUrl : pgTool.getDbUrlFromConfig(configOrDbUrl);
        this.configFile = initConfigFile;
        this.includeFilter = [];
        this.excludeFilter = [];
        this.showSql = debug;
        this.connection = null;
    }

    async connect() {
        if (!this.connection) {
            this.connection = new Client({
                connectionString: this.dbUrl,
            });
            await this.connection.connect();
        }
        return this.connection;
    }

    async close() {
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
        }
    }

    setDebug(debug) {
        this.showSql = debug;
    }

    setIncludeFilter(includeFilter) {
        this.includeFilter = includeFilter;
    }

    setExcludeFilter(excludeFilter) {
        this.excludeFilter = excludeFilter;
    }

    async execute(sql, params = [], many = false) {
        const connection = await this.connect();
        if (this.showSql) {
            console.log(sql);
        }
        const result = await connection.query(sql, params);
        return many ? result.rows : result.rows[0];
    }

    async initDatabase(tableMaps) {
        await this.createTables(tableMaps);
    }

    async insertOne(tabname, data) {
        const keys = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map((_, i) => `$${i + 1}`).join(', ');
        const sql = `INSERT INTO ${tabname} (${keys}) VALUES (${placeholders}) RETURNING id`;
        const result = await this.execute(sql, Object.values(data));
        return result.id;
    }

    async updateOne(tabname, data, conditions) {
        const setClause = Object.keys(data).map((key, i) => `${key} = $${i + 1}`).join(', ');
        const [whereClause, values] = pgTool.buildConditions(conditions, Object.keys(data).length);
        const sql = `UPDATE ${tabname} SET ${setClause} WHERE ${whereClause}`;
        await this.execute(sql, [...Object.values(data), ...values]);
    }

    async readOne(tablename, conditions = {}, select = '*') {
        const [whereClause, values] = pgTool.buildConditions(conditions);
        const sql = `SELECT ${select} FROM ${tablename} ${whereClause ? `WHERE ${whereClause}` : ''} LIMIT 1`;
        const result = await this.execute(sql, values);
        return result || null;
    }

    async insertMany(tabname, data) {
        if (data.length === 0) return;

        const keys = Object.keys(data[0]).join(', ');
        const placeholders = data.map((_, i) => `(${Object.keys(data[0]).map((_, j) => `$${i * Object.keys(data[0]).length + j + 1}`).join(', ')})`).join(', ');
        const sql = `INSERT INTO ${tabname} (${keys}) VALUES ${placeholders}`;

        const values = data.reduce((acc, row) => [...acc, ...Object.values(row)], []);
        await this.execute(sql, values, true);
    }

    async updateMany(tabname, data, conditions) {
        if (data.length === 0) return;

        const setClause = Object.keys(data[0]).map((key, i) => `${key} = $${i + 1}`).join(', ');
        const [whereClause, condValues] = pgTool.buildConditions(conditions, Object.keys(data[0]).length);
        const sql = `UPDATE ${tabname} SET ${setClause} WHERE ${whereClause}`;

        const values = data.map(row => [...Object.values(row), ...condValues]);
        for (const valueSet of values) {
            await this.execute(sql, valueSet, true);
        }
    }

    async readMany(tablename, conditions = {}, limit = [0, 1000], select = '*', sort = null) {
        const [whereClause, values] = pgTool.buildConditions(conditions);
        const sortClause = sort ? ` ORDER BY ${Object.entries(sort).map(([k, v]) => `${k} ${v}`).join(', ')}` : '';
        const limitClause = ` LIMIT ${limit[1]} OFFSET ${limit[0]}`;
        const sql = `SELECT ${select} FROM ${tablename} ${whereClause ? `WHERE ${whereClause}` : ''} ${sortClause} ${limitClause}`;
        return await this.execute(sql, values);
    }

    async delete(tabname, conditions = {}, physical = false) {
        const [whereClause, values] = pgTool.buildConditions(conditions);
        const sql = physical ? `DELETE FROM ${tabname} WHERE ${whereClause}` : `UPDATE ${tabname} SET deleted = true WHERE ${whereClause}`;
        await this.execute(sql, values);
    }

    async getTable(tabname) {
        const sql = `SELECT column_name, data_type, is_nullable, column_default, is_identity FROM information_schema.columns WHERE table_name = $1`;
        const columns = await this.execute(sql, [tabname], true);
        return pgTool.reduceColumns(columns);
    }

    async getTableMaps() {
        const tables = await this.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'", [], true);
        const tableNames = tables.map(row => row.table_name);
        const filteredTables = pgTool.filterTables(tableNames, this.includeFilter, this.excludeFilter);
        const tableMaps = {};
        for (const table of filteredTables) {
            tableMaps[table] = await this.getTable(table);
        }
        return tableMaps;
    }

    async showTableMap() {
        const tableMaps = await this.getTableMaps();
        for (const [table, fields] of Object.entries(tableMaps)) {
            console.log(`Table: ${table}`);
            for (const [field, info] of Object.entries(fields)) {
                console.log(`  Field: ${field} - ${JSON.stringify(info)}`);
            }
        }
    }

    async createTable(tablename, fields) {
        if (await this.tableExists(tablename)) {
            console.log(`Table '${tablename}' already exists. Skipping creation.`);
            return;
        }

        const columns = Object.entries(fields).map(([name, info]) => {
            let columnDef = `${name} ${pgTool.getColumnType(info.type)}`;
            if (info.primary_key) columnDef += ' PRIMARY KEY';
            if (info.notnull) columnDef += ' NOT NULL';
            if (info.default_value !== undefined) columnDef += ` DEFAULT '${info.default_value}'`;
            if (info.is_identity) columnDef += ' GENERATED ALWAYS AS IDENTITY';
            return columnDef;
        });

        const sql = `CREATE TABLE ${tablename} (${columns.join(', ')})`;
        await this.execute(sql);
        console.log(`Table '${tablename}' created successfully.`);
    }

    async createTables(tableMaps) {
        for (const [tablename, fields] of Object.entries(tableMaps)) {
            await this.createTable(tablename, fields);
        }
    }

    async dropTable(tablename) {
        const sql = `DROP TABLE IF EXISTS ${tablename}`;
        await this.execute(sql);
    }

    async tableExists(tablename) {
        const sql = `SELECT 1 FROM information_schema.tables WHERE table_name = $1 AND table_schema = 'public'`;
        const result = await this.execute(sql, [tablename]);
        return result.length > 0;
    }
}

export default PostgreSQL;
