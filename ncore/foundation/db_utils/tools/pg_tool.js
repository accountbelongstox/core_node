class PostgreSQLTool {
    constructor() {
        this.typeMapping = {
            "INTEGER": "INTEGER",
            "SMALLINT": "SMALLINT",
            "BIGINT": "BIGINT",
            "FLOAT": "REAL",
            "DOUBLE": "DOUBLE PRECISION",
            "DECIMAL": "NUMERIC",
            "STRING": "TEXT",
            "TEXT": "TEXT",
            "BLOB": "BYTEA",
            "DATE": "DATE",
            "DATETIME": "TIMESTAMP",
            "TIMESTAMP": "TIMESTAMP",
            "TIME": "TIME",
            "CHAR": "CHAR(1)",
            "BOOLEAN": "BOOLEAN"
        };
    }

    buildConditions(conditions, offset = 0) {
        if (!conditions || Object.keys(conditions).length === 0) {
            return ["", []];
        }

        const clauses = [];
        const values = [];

        Object.entries(conditions).forEach(([key, val], index) => {
            const paramIndex = offset + index + 1;
            if (val.startsWith(">=")) {
                clauses.push(`${key} >= $${paramIndex}`);
                values.push(val.slice(2));
            } else if (val.startsWith("<=")) {
                clauses.push(`${key} <= $${paramIndex}`);
                values.push(val.slice(2));
            } else if (val.startsWith(">")) {
                clauses.push(`${key} > $${paramIndex}`);
                values.push(val.slice(1));
            } else if (val.startsWith("<")) {
                clauses.push(`${key} < $${paramIndex}`);
                values.push(val.slice(1));
            } else if (val.startsWith("!=")) {
                clauses.push(`${key} != $${paramIndex}`);
                values.push(val.slice(2));
            } else if (val.startsWith("%") && val.endsWith("%")) {
                clauses.push(`${key} LIKE $${paramIndex}`);
                values.push(val);
            } else if (val.startsWith("%")) {
                clauses.push(`${key} LIKE $${paramIndex}`);
                values.push(`%${val.slice(1)}`);
            } else if (val.endsWith("%")) {
                clauses.push(`${key} LIKE $${paramIndex}`);
                values.push(`${val.slice(0, -1)}%`);
            } else {
                clauses.push(`${key} = $${paramIndex}`);
                values.push(val);
            }
        });

        return [clauses.join(" AND "), values];
    }

    getColumnType(colType) {
        return this.typeMapping[colType.toUpperCase()] || "TEXT";
    }

    filterTables(tables, includeFilter = [], excludeFilter = []) {
        const systemTables = new Set([
            'pg_catalog', 'information_schema', 'pg_toast', 
            'pg_temp_1', 'pg_toast_temp_1'
        ]);
        return tables.filter(table => 
            !systemTables.has(table) &&
            (includeFilter.length === 0 || includeFilter.includes(table)) &&
            (excludeFilter.length === 0 || !excludeFilter.includes(table))
        );
    }

    reduceColumns(columns) {
        return columns.reduce((acc, col, idx) => {
            acc[col.column_name] = {
                cid: idx,
                name: col.column_name,
                type: col.data_type,
                notnull: col.is_nullable === 'NO',
                default_value: col.column_default,
                primary_key: col.is_identity === 'YES',
                hidden: false
            };
            return acc;
        }, {});
    }

    getDbUrlFromConfig(config) {
        const dbname = config.PG_DB || "database";
        const user = config.PG_USER || "postgres";
        const password = config.PG_PWD || "";
        const host = config.PG_HOST || "localhost";
        const port = config.PG_PORT || 5432;
        return `postgresql://${user}:${password}@${host}:${port}/${dbname}`;
    }
}

const pgTool = new PostgreSQLTool();
export default pgTool;
