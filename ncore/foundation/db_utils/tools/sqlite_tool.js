// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

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
