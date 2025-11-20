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

const { DataTypes } = require('sequelize');

class DataTypesMapper {
  static MYSQL = {
    'INT': DataTypes.INTEGER,
    'INTEGER': DataTypes.INTEGER,
    'TINYINT': DataTypes.INTEGER,
    'SMALLINT': DataTypes.INTEGER,
    'MEDIUMINT': DataTypes.INTEGER,
    'BIGINT': DataTypes.BIGINT,
    'UNSIGNED BIG INT': DataTypes.BIGINT,
    'BIG INT': DataTypes.BIGINT,
    'INT2': DataTypes.SMALLINT,
    'INT8': DataTypes.BIGINT,
    'CHARACTER': DataTypes.STRING,
    'VARCHAR': DataTypes.STRING,
    'CHAR': DataTypes.STRING,
    'VARYING CHARACTER': DataTypes.STRING,
    'NCHAR': DataTypes.STRING,
    'NATIVE CHARACTER': DataTypes.STRING,
    'NVARCHAR': DataTypes.STRING,
    'TEXT': DataTypes.TEXT,
    'FILE': DataTypes.TEXT,
    'CLOB': DataTypes.TEXT,
    'BLOB': DataTypes.BLOB,
    'REAL': DataTypes.FLOAT,
    'DOUBLE': DataTypes.FLOAT,
    'DOUBLE PRECISION': DataTypes.FLOAT,
    'FLOAT': DataTypes.FLOAT,
    'NUMERIC': DataTypes.DECIMAL,
    'DECIMAL': DataTypes.DECIMAL,
    'BOOLEAN': DataTypes.BOOLEAN,
    'DATE': DataTypes.DATEONLY,
    'DATETIME': DataTypes.DATE
  };

  static SQLITE = {
    'INT': DataTypes.INTEGER,
    'INTEGER': DataTypes.INTEGER,
    'TINYINT': DataTypes.INTEGER,
    'SMALLINT': DataTypes.INTEGER,
    'MEDIUMINT': DataTypes.INTEGER,
    'BIGINT': DataTypes.BIGINT,
    'UNSIGNED BIG INT': DataTypes.BIGINT,
    'BIG INT': DataTypes.BIGINT,
    'INT2': DataTypes.SMALLINT,
    'INT8': DataTypes.BIGINT,
    'CHARACTER': DataTypes.STRING,
    'VARCHAR': DataTypes.STRING,
    'CHAR': DataTypes.STRING,
    'VARYING CHARACTER': DataTypes.STRING,
    'NCHAR': DataTypes.STRING,
    'NATIVE CHARACTER': DataTypes.STRING,
    'NVARCHAR': DataTypes.STRING,
    'TEXT': DataTypes.TEXT,
    'CLOB': DataTypes.TEXT,
    'BLOB': DataTypes.BLOB,
    'REAL': DataTypes.FLOAT,
    'DOUBLE': DataTypes.FLOAT,
    'DOUBLE PRECISION': DataTypes.FLOAT,
    'FLOAT': DataTypes.FLOAT,
    'NUMERIC': DataTypes.DECIMAL,
    'DECIMAL': DataTypes.DECIMAL,
    'BOOLEAN': DataTypes.BOOLEAN,
    'DATE': DataTypes.DATEONLY,
    'DATETIME': DataTypes.DATE
  };

  static getFieldType(dbType, db = 'MYSQL') {
    if (db === 'MYSQL') {
      return this.MYSQL[dbType.toUpperCase()] || DataTypes.STRING;
    } else if (db === 'SQLITE') {
      return this.SQLITE[dbType.toUpperCase()] || DataTypes.STRING;
    } else {
      throw new Error(`Unsupported database type: ${db}`);
    }
  }
}

module.exports = DataTypesMapper;
