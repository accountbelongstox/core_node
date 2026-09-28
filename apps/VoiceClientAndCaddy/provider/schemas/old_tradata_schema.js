const { DataTypes } = require('#@/ncore/utils/db_tool/sequelize_db.js');
const {DictionariesTableName} = require('../types/data_table_names.js')
const old_tradata_schema = {
    [DictionariesTableName]: {
        content: {
            type: DataTypes.TEXT,
            primaryKey: true,
            allowNull: false
        },
        translation: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        lastModified: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        us_phonetic: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        uk_phonetic: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        voice_files: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        phonetic_symbol: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        sample_images: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }
};

module.exports = {      
    old_tradata_schema,
};