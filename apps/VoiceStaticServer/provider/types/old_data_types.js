const { DataTypes } = require('#@/ncore/utils/db_tool/sequelize_db.js');

const sequelize_init_tables = {
    translation_dictionary: {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: true,
            autoIncrement: true 
        },
        word: {
            type: DataTypes.CHAR(100),
            unique: true,
        },
        language: {
            type: DataTypes.TEXT,
        },
        translate_bing: {
            type: DataTypes.TEXT,
        },
        last_time: {
            type: DataTypes.STRING,
        },
        read: {
            type: DataTypes.INTEGER,
        },
        time: {
            type: DataTypes.STRING,
        },
        read_time: {
            type: DataTypes.STRING,
        },
        word_sort: {
            type: DataTypes.STRING(100),
        },
        phonetic_us: {
            type: DataTypes.STRING(50),
        },
        phonetic_us_sort: {
            type: DataTypes.STRING(50),
        },
        phonetic_uk: {
            type: DataTypes.STRING(50),
        },
        phonetic_uk_sort: {
            type: DataTypes.STRING(50),
        },
        is_delete: {
            type: DataTypes.INTEGER,
        },
        phonetic_uk_length: {
            type: DataTypes.INTEGER,
        },
        phonetic_us_length: {
            type: DataTypes.INTEGER,
        },
        word_length: {
            type: DataTypes.INTEGER,
        },
    },
};

module.exports = {
    sequelize_init_tables
};