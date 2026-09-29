const { DataTypes } = require('#@/ncore/utils/db_tool/sequelize_db.js');
const {DictionariesTableName} = require('../types/data_table_names.js')
//cache_translate_text_tables
const cache_translate_schema = {
    [DictionariesTableName]: {
        content: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        translation: {
            type: DataTypes.JSON,
            defaultValue: null,
            allowNull: true
        },
        done: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: true
        },
        done_at: {
            type: DataTypes.DATE,
            defaultValue: null,
            allowNull: true
        }
    }
};

module.exports = {      
    cache_translate_schema,
};