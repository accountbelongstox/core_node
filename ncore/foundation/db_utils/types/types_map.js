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
