function filterTables(tables, includeFilter = [], excludeFilter = []) {
    const systemTables = new Set(['sqlite_sequence', 'sqlite_stat1', 'sqlite_stat2', 'sqlite_stat3', 'sqlite_stat4']);
    return tables.filter(table => !systemTables.has(table) &&
        (includeFilter.length === 0 || includeFilter.includes(table)) &&
        (excludeFilter.length === 0 || !excludeFilter.includes(table)));
}

function reduceColumns(columns) {
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

function getDbFileFromConfig(config) {
    const getValue = (key, defaultValue) => {
        if (config.getEnv) {
            return config.getEnv(key) || defaultValue;
        }
        return config[key] || defaultValue;
    };

    const dbFile = getValue('SQLITE_DB', 'database');
    return dbFile;
}

module.exports = {
    filterTables,
    reduceColumns,
    getDbFileFromConfig,
};
