const Base = require('#@base');
    const fs = require('fs');
    const path = require('path');
    let dataTypes = null;

    const __filename = __filename;
    const __dirname = path.dirname(__filename);

    class SQLiteTool extends Base {
        constructor() {
            super();
            if (!dataTypes) dataTypes = this.loadJSON('../types/sqlite_types.json');
            this.typeMapping = {
                "INTEGER": "INTEGER",
                "SMALLINT": "SMALLINT",
                "BIGINT": "BIGINT",
                "FLOAT": "REAL",
                "DOUBLE": "REAL",
                "DECIMAL": "NUMERIC",
                "STRING": "TEXT",
                "TEXT": "TEXT",
                "BLOB": "BLOB",
                "DATE": "TEXT",
                "DATETIME": "TEXT",
                "TIMESTAMP": "TEXT",
                "TIME": "TEXT",
                "CHAR": "TEXT",
                "BOOLEAN": "INTEGER" // SQLite does not have a separate BOOLEAN type
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
            return this.typeMapping[colType.toUpperCase()] || "TEXT";
        }

        filterTables(tables, includeFilter = [], excludeFilter = []) {
            const systemTables = new Set(['sqlite_sequence', 'sqlite_stat1', 'sqlite_stat2', 'sqlite_stat3', 'sqlite_stat4']);
            return tables.filter(table => !systemTables.has(table) &&
                (includeFilter.length === 0 || includeFilter.includes(table)) &&
                (excludeFilter.length === 0 || !excludeFilter.includes(table)));
        }

        reduceColumns(columns) {
            return columns.reduce((acc, col, idx) => {
                acc[col.name] = {
                    cid: idx,
                    name: col.name,
                    type: col.type,
                    notnull: col.notnull === 1,
                    default_value: col.dflt_value,
                    primary_key: col.pk === 1,
                    hidden: false
                };
                return acc;
            }, {});
        }

        getDbFileFromConfig(config) {
            const getValue = (key, defaultValue) => {
                if (config.getEnv) {
                    return config.getEnv(key) || defaultValue;
                }
                return config[key] || defaultValue;
            };

            const dbFile = getValue('SQLITE_DB', 'database');
            return dbFile;
        }
    }

    const sqliteTool = new SQLiteTool();
    module.exports = sqliteTool;