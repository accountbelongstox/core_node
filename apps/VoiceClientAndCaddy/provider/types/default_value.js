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