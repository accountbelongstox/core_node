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