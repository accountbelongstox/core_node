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