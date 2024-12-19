const sqlite3 = require('sqlite3');
    const { open } = require('sqlite');
    const sqliteTool = require('../utils/sqlite_tool.js');
    const Base = require('#@base');

    class SQLite extends Base {
      constructor(configOrDbFile, initConfigFile = '', debug = false) {
        super()
        this.dbFile = typeof configOrDbFile === 'string' ? configOrDbFile : sqliteTool.getDbFileFromConfig(configOrDbFile);
        this.configFile = initConfigFile;
        this.includeFilter = [];
        this.excludeFilter = [];
        this.showSql = debug;
        this.connection = null;
      }

      async connect() {
        if (!this.connection) {
          this.connection = await open({
            filename: this.dbFile,
            driver: sqlite3.Database
          });
        }
        return this.connection;
      }

      async close() {
        if (this.connection) {
          await this.connection.close();
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

      async execute(sql, params = []) {
        const connection = await this.connect();
        if (this.showSql) {
          console.log(sql);
        }
        const result = await connection.run(sql, params);
        return result;
      }

      async query(sql, params = []) {
        const connection = await this.connect();
        if (this.showSql) {
          console.log(sql);
        }
        const result = await connection.all(sql, params);
        return result;
      }

      async initDatabase(tableMaps) {
        await this.createTables(tableMaps);
      }

      async insertOne(tabname, data) {
        const keys = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const sql = `INSERT INTO ${tabname} (${keys}) VALUES (${placeholders})`;
        const result = await this.execute(sql, Object.values(data));
        return result.lastID;
      }

      async updateOne(tabname, data, conditions) {
        const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
        const [whereClause, values] = sqliteTool.buildConditions(conditions);
        const sql = `UPDATE ${tabname} SET ${setClause} WHERE ${whereClause}`;
        await this.execute(sql, [...Object.values(data), ...values]);
      }

      async readOne(tablename, conditions = {}, select = '*') {
        const [whereClause, values] = sqliteTool.buildConditions(conditions);
        const sql = `SELECT ${select} FROM ${tablename} ${whereClause ? `WHERE ${whereClause}` : ''}`;
        const result = await this.query(sql, values);
        return result[0] || null;
      }

      async insertMany(tabname, data) {
        if (data.length === 0) return;

        const keys = Object.keys(data[0]).join(', ');
        const placeholders = Object.keys(data[0]).map(() => '?').join(', ');
        const sql = `INSERT INTO ${tabname} (${keys}) VALUES (${placeholders})`;

        const values = data.map(row => Object.values(row));
        const connection = await this.connect();
        const stmt = await connection.prepare(sql);
        try {
          for (const row of values) {
            await stmt.run(row);
          }
        } finally {
          await stmt.finalize();
        }
      }

      async updateMany(tabname, data, conditions) {
        if (data.length === 0) return;

        const setClause = Object.keys(data[0]).map(key => `${key} = ?`).join(', ');
        const [whereClause, condValues] = sqliteTool.buildConditions(conditions);
        const sql = `UPDATE ${tabname} SET ${setClause} WHERE ${whereClause}`;
        
        const connection = await this.connect();
        const stmt = await connection.prepare(sql);
        try {
          for (const row of data) {
            await stmt.run([...Object.values(row), ...condValues]);
          }
        } finally {
          await stmt.finalize();
        }
      }

      async readMany(tablename, conditions = {}, limit = [0, 1000], select = '*', sort = null) {
        const [whereClause, values] = sqliteTool.buildConditions(conditions);
        const sortClause = sort ? ` ORDER BY ${Object.entries(sort).map(([k, v]) => `${k} ${v}`).join(', ')}` : '';
        const limitClause = ` LIMIT ${limit[0]}, ${limit[1]}`;
        const sql = `SELECT ${select} FROM ${tablename} ${whereClause ? `WHERE ${whereClause}` : ''} ${sortClause} ${limitClause}`;
        return await this.query(sql, values);
      }

      async delete(tabname, conditions = {}, physical = false) {
        const [whereClause, values] = sqliteTool.buildConditions(conditions);
        const sql = physical ? `DELETE FROM ${tabname} WHERE ${whereClause}` : `UPDATE ${tabname} SET deleted = 1 WHERE ${whereClause}`;
        await this.execute(sql, values);
      }

      async getTable(tabname) {
        const sql = `PRAGMA table_info(${tabname})`;
        const columns = await this.query(sql);
        return sqliteTool.reduceColumns(columns);
      }

      async getTableMaps() {
        const tables = await this.query("SELECT name FROM sqlite_master WHERE type='table'");
        const tableNames = tables.map(row => row.name);
        const filteredTables = sqliteTool.filterTables(tableNames, this.includeFilter, this.excludeFilter);
        const tableMaps = {};
        for (const table of filteredTables) {
          tableMaps[table] = await this.getTable(table);
        }
        return tableMaps;
      }

      async showTableMap() {
        const tableMaps = await this.getTableMaps();
        for (const [table, fields] of Object.entries(tableMaps)) {
          console.log(`\n\tTable: ${table}`);
          for (const [field, info] of Object.entries(fields)) {
            console.log(`\t\t ${field} : ${JSON.stringify(info)}`);
          }
        }
      }

      async createTable(tablename, fields) {
        if (await this.tableExists(tablename)) {
          console.log(`Table '${tablename}' already exists. Skipping creation.`);
          return;
        }

        const columns = Object.entries(fields).map(([name, info]) => {
          let columnDef = `${name} ${sqliteTool.getColumnType(info.type)}`;
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
        const sql = `SELECT name FROM sqlite_master WHERE type='table' AND name=?`;
        const result = await this.query(sql, [tablename]);
        return result.length > 0;
      }

      async migrateData(targetDb) {
        // Implement your data migration logic here
      }
    }

    module.exports = SQLite;