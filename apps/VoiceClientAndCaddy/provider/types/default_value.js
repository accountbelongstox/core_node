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

const { DataTypes } = require('#@/ncore/utils/db_tool/sequelize_db.js');

const isValideDefaultValue = (defaultValue) => {
    if (defaultValue !== undefined &&
        (
            typeof defaultValue === 'string' ||
            typeof defaultValue === 'number' ||
            typeof defaultValue === 'boolean'
        )
    ) {
        return true;
    }
    return false;
}

const getDefaultValueForType = (key, sequelize_tables, tablename) => {
    const schema = sequelize_tables[tablename][key];
    if (isValideDefaultValue(schema.defaultValue)) {
        return schema.defaultValue;
    }
    if (schema.type instanceof DataTypes.INTEGER) {
        return 0;
    }
    if (schema.type instanceof DataTypes.FLOAT) {
        return 0.0;
    }
    if (schema.type instanceof DataTypes.DOUBLE) {
        return 0.0;
    }
    if (schema.type instanceof DataTypes.STRING) {
        return '';
    }
    if (schema.type instanceof DataTypes.TEXT) {
        return '';
    }
    if (schema.type instanceof DataTypes.CHAR) {
        return '';
    }
    if (schema.type instanceof DataTypes.BOOLEAN) {
        return false;
    }
    if (schema.type instanceof DataTypes.DATE) {
        return Math.floor(Date.now() / 1000);
    }
    if (schema.type instanceof DataTypes.JSON) {
        return null;
    }
    if (schema.type instanceof DataTypes.JSONB) {
        return null;
    }
    if (schema.type instanceof DataTypes.ARRAY) {
        return [];
    }
    return null;
}


module.exports = {
    getDefaultValueForType,
};