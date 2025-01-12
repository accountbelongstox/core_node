const fs = require('fs');
    const path = require('path');
    const Base = require('#@base');
    
    const __filename = __filename;
    const __dirname = path.dirname(__filename);
    
    let dataTypes = null;

    class MySQLTool extends Base {
      constructor() {
        super();
        if (!dataTypes) dataTypes = this.loadJSON('../types/mysql_types.json');
        this.typeMapping = {
          "INTEGER": "INT",
          "SMALLINT": "SMALLINT",
          "BIGINT": "BIGINT",
          "FLOAT": "FLOAT",
          "DOUBLE": "DOUBLE",
          "DECIMAL": "DECIMAL",
          "STRING": "VARCHAR(255)",
          "TEXT": "TEXT",
          "BLOB": "BLOB",
          "DATE": "DATE",
          "DATETIME": "DATETIME",
          "TIMESTAMP": "TIMESTAMP",
          "TIME": "TIME",
          "CHAR": "CHAR(1)",
          "BOOLEAN": "TINYINT(1)"
        };
      }

      loadJSON(jfile) {
        const filePath = path.resolve(__dirname, jfile);
        try {
          const data = fs.readFileSync(filePath, 'utf8');
          return JSON.parse(data);
        } catch (error) {
          console.error('Error reading JSON file:', error);
          return {};
        }
      }

      buildConditions(conditions) {
        if (!conditions || Object.keys(conditions).length === 0) {
          return ["", []];
        }

        const clauses = [];
        const values = [];

        for (const [key, val] of Object.entries(conditions)) {
          if (val.startsWith(">=")) {
            clauses.push(`${key} >= ?`);
            values.push(val.slice(2));
          } else if (val.startsWith("<=")) {
            clauses.push(`${key} <= ?`);
            values.push(val.slice(2));
          } else if (val.startsWith(">")) {
            clauses.push(`${key} > ?`);
            values.push(val.slice(1));
          } else if (val.startsWith("<")) {
            clauses.push(`${key} < ?`);
            values.push(val.slice(1));
          } else if (val.startsWith("!=")) {
            clauses.push(`${key} != ?`);
            values.push(val.slice(2));
          } else if (val.startsWith("%") && val.endsWith("%")) {
            clauses.push(`${key} LIKE ?`);
            values.push(val);
          } else if (val.startsWith("%")) {
            clauses.push(`${key} LIKE ?`);
            values.push(`%${val.slice(1)}`);
          } else if (val.endsWith("%")) {
            clauses.push(`${key} LIKE ?`);
            values.push(`${val.slice(0, -1)}%`);
          } else {
            clauses.push(`${key} = ?`);
            values.push(val);
          }
        }

        return [clauses.join(" AND "), values];
      }

      getColumnType(colType) {
        return this.typeMapping[colType.toUpperCase()] || "VARCHAR(255)";
      }

      filterTables(tables, includeFilter = [], excludeFilter = []) {
        const systemTables = new Set(['sqlite_sequence', 'sqlite_stat1', 'sqlite_stat2', 'sqlite_stat3', 'sqlite_stat4']);
        return tables.filter(table => !systemTables.has(table) &&
          (includeFilter.length === 0 || includeFilter.includes(table)) &&
          (excludeFilter.length === 0 || !excludeFilter.includes(table)));
      }

      reduceColumns(columns) {
        return columns.reduce((acc, col, idx) => {
          acc[col.Field] = {
            cid: idx,
            name: col.Field,
            type: col.Type,
            notnull: col.Null === 'NO',
            default_value: col.Default,
            primary_key: col.Key.includes('PRI'),
            hidden: false
          };
          return acc;
        }, {});
      }

      getDbUrlFromConfig(config) {
        // Function to get environment variable or default value
        const getValue = (key, defaultValue) => {
          if (config.getEnv) {
            return config.getEnv(key) || defaultValue;
          }
          return config[key] || defaultValue;
        };

        const dbname = getValue('MYSQL_DB', 'database');
        const user = getValue('MYSQL_USER', 'root');
        const password = getValue('MYSQL_PWD', '');
        const host = getValue('MYSQL_HOST', 'localhost');
        const port = getValue('MYSQL_PORT', 3306);

        return `mysql://${user}:${password}@${host}:${port}/${dbname}`;
      }

      isValidType(type) {
        return dataTypes.includes(type.toUpperCase());
      }

      addType(type) {
        const typeUpper = type.toUpperCase();
        if (!this.isValidType(typeUpper)) {
          dataTypes.push(typeUpper);
        }
      }
    }

    const mySQLTool = new MySQLTool();
    module.exports = mySQLTool;