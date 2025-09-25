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

const { getDefaultValueForType } = require(`../../provider/types/default_value.js`)
const logSpacename = 'DBItemAlign';
const logInterval = 20;
const logger = require('#@logger');
const { DictionariesTableName } = require(`../../provider/types/data_table_names.js`);

const dbItemAlign = (data, schema, tableName, keepIdKey = true) => {
    const wordValidKeys = new Set(Object.keys(schema[DictionariesTableName]));
    wordValidKeys.forEach(key => {
        let value = data[key];
        if (!value && value !== null) {
            const defaultValue = getDefaultValueForType(key, schema, tableName);
            if (defaultValue === null) {
                logger.interval(`defaultValue is null for key: ${key}`, logInterval, logSpacename, 'warn');
            }
            data[key] = defaultValue;
        }
    });
    Object.entries(data).forEach(([key, value]) => {
        if (!wordValidKeys.has(key)) {
            delete data[key];
            logger.interval(`Unknown field will be removed: ${key}`, logInterval, logSpacename, 'warn');
        }
    });
    if (!keepIdKey && data.id !== undefined) {
        delete data.id;
        logger.interval(`id will be removed: ${data.id}`, logInterval, logSpacename, 'warn');
    }
    return data;
};


module.exports = {
    dbItemAlign,
};