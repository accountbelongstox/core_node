const mysql = require('mysql2/promise');
    const mysqlTool = require('../tools/mysql_tool.js');
    const Base = require('#@base');
    // const net = require('net');

    class MySQL extends Base {
        constructor(configOrDbUrl, initConfigFile = '', debug = false) {
            super();
            this.dbUrl = typeof configOrDbUrl === 'string' ? configOrDbUrl : mysqlTool.getDbUrlFromConfig(configOrDbUrl);
            this.configFile = initConfigFile;
            this.includeFilter = [];
            this.excludeFilter = [];
            this.showSql = debug;
            this.connection = null;
        }

        async connect() {
            if (!this.connection) {
                this.connection = await mysql.createConnection(this.dbUrl);
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
            const [results] = many ? await connection.query(sql, [params]) : await connection.execute(sql, params);
            return results;
        }

        async initDatabase(tableMaps) {
            await this.createTables(tableMaps);
        }

        async insertOne(tabname, data) {
            console.log(`data`,data)
            const keys = Object.keys(data).join(', ');
            const placeholders = Object.keys(data).map(() => '?').join(', ');
            const sql = `INSERT INTO ${tabname} (${keys}) VALUES (${placeholders})`;
            console.log(`sql`,sql)
            const result = await this.execute(sql, Object.values(data));
            return result.insertId;
        }

        async updateOne(tabname, data, conditions) {
            const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
            const [whereClause, values] = mysqlTool.buildConditions(conditions);
            const sql = `UPDATE ${tabname} SET ${setClause} WHERE ${whereClause}`;
            await this.execute(sql, [...Object.values(data), ...values]);
        }

        async readOne(tablename, conditions = {}, select = '*') {
            const [whereClause, values] = mysqlTool.buildConditions(conditions);
            const sql = `SELECT ${select} FROM ${tablename} ${whereClause ? `WHERE ${whereClause}` : ''}`;
            const result = await this.execute(sql, values);
            return result[0] || null;
        }

        async insertMany(tabname, data) {
            if (data.length === 0) return;

            const keys = Object.keys(data[0]).join(', ');
            const placeholders = Object.keys(data[0]).map(() => '?').join(', ');
            const sql = `INSERT INTO ${tabname} (${keys}) VALUES (${placeholders})`;

            const values = data.map(row => Object.values(row));
            await this.execute(sql, values, true);
        }

        async updateMany(tabname, data, conditions) {
            if (data.length === 0) return;

            const setClause = Object.keys(data[0]).map(key => `${key} = ?`).join(', ');
            const [whereClause, condValues] = mysqlTool.buildConditions(conditions);
            const values = data.map(row => [...Object.values(row), ...condValues]);
            const sql = `UPDATE ${tabname} SET ${setClause} WHERE ${whereClause}`;
            await this.execute(sql, values, true);
        }

        async readMany(tablename, conditions = {}, limit = [0, 1000], select = '*', sort = null) {
            const [whereClause, values] = mysqlTool.buildConditions(conditions);
            const sortClause = sort ? ` ORDER BY ${Object.entries(sort).map(([k, v]) => `${k} ${v}`).join(', ')}` : '';
            const limitClause = ` LIMIT ${limit[0]}, ${limit[1]}`;
            const sql = `SELECT ${select} FROM ${tablename} ${whereClause ? `WHERE ${whereClause}` : ''} ${sortClause} ${limitClause}`;
            return await this.execute(sql, values);
        }

        async delete(tabname, conditions = {}, physical = false) {
            const [whereClause, values] = mysqlTool.buildConditions(conditions);
            const sql = physical ? `DELETE FROM ${tabname} WHERE ${whereClause}` : `UPDATE ${tabname} SET deleted = 1 WHERE ${whereClause}`;
            await this.execute(sql, values);
        }

        async getTable(tabname) {
            const sql = `SHOW FULL COLUMNS FROM ${tabname}`;
            const columns = await this.execute(sql);
            return mysqlTool.reduceColumns(columns);
        }

        async getTableMaps() {
            const tables = await this.execute("SHOW TABLES");
            const tableNames = tables.map(row => Object.values(row)[0]);
            const filteredTables = mysqlTool.filterTables(tableNames, this.includeFilter, this.excludeFilter);
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
                let columnDef = `${name} ${mysqlTool.getColumnType(info.type)}`;
                if (info.primary_key) columnDef += ' PRIMARY KEY';
                if (info.notnull) columnDef += ' NOT NULL';
                if (info.default_value !== undefined) columnDef += ` DEFAULT '${info.default_value}'`;
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
            const sql = `SELECT 1 FROM information_schema.tables WHERE table_name = ?`;
            const result = await this.execute(sql, [tablename]);
            return result.length > 0;
        }
    }

    module.exports = MySQL;