const { DataTypes } = require('#@/ncore/utils/db_tool/sequelize_db.js');
const { DictionariesTableName, CacheDbDoneTableName } = require('../types/data_table_names.js')
// sequelize_main_tables
const word_main_schema = {
    [DictionariesTableName]: {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        content: {
            type: DataTypes.TEXT,
            defaultValue: null,
            allowNull: false
        },
        md5: {
            type: DataTypes.TEXT,
            defaultValue: null,
            allowNull: false
        },
        translation: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: null
        },
        isTranslation: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: true
        },
        translation_provider: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        },
        lastModified: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            allowNull: true
        },
        lastInsertTime: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            allowNull: true
        },
        lastUpdateTime: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            allowNull: true
        },
        lastQueryTime: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            allowNull: true
        },
        queryCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: true
        },
        usPhonetic: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: null
        },
        ukPhonetic: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: null
        },
        voice_files: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: null
        },
        image_files: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: null
        },
        isExistLocal: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: true
        },
        voice_files_provider: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: true
        },
        image_files_provider: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: true
        },
        hasOperations: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: true
        },
        createdAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            allowNull: true
        }
    },
    [CacheDbDoneTableName]: {
        cache_db_name: {
            type: DataTypes.TEXT,
            defaultValue: null,
            allowNull: false
        },
        done: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        },
        createdAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            allowNull: true
        }
    }
};

module.exports = {
    word_main_schema,
};