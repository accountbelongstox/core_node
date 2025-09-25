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

const { Sequelize } = require('sequelize');
const logger = require('#@logger');
const fs = require('fs');
const path = require('path');

/**
 * Convert database type to Sequelize type
 * @param {string} dbType - Database type
 * @returns {string} Sequelize type
 */
function getSequelizeType(dbType) {
    const typeStr = dbType.toString().toUpperCase();
    
    if (typeStr.includes('VARCHAR') || typeStr.includes('CHARACTER VARYING')) {
        const length = typeStr.match(/\((\d+)\)/);
        return length ? `STRING(${length[1]})` : 'STRING';
    }
    if (typeStr.includes('CHAR')) {
        const length = typeStr.match(/\((\d+)\)/);
        return length ? `CHAR(${length[1]})` : 'CHAR';
    }
    if (typeStr.includes('TEXT')) return 'TEXT';
    if (typeStr.includes('INTEGER')) return 'INTEGER';
    if (typeStr.includes('BIGINT')) return 'BIGINT';
    if (typeStr.includes('FLOAT')) return 'FLOAT';
    if (typeStr.includes('DOUBLE')) return 'DOUBLE';
    if (typeStr.includes('DECIMAL')) return 'DECIMAL';
    if (typeStr.includes('BOOLEAN')) return 'BOOLEAN';
    if (typeStr.includes('DATE')) return 'DATE';
    if (typeStr.includes('TIME')) return 'TIME';
    if (typeStr.includes('DATETIME')) return 'DATE';
    if (typeStr.includes('TIMESTAMP')) return 'DATE';
    if (typeStr.includes('JSON')) return 'JSON';
    if (typeStr.includes('JSONB')) return 'JSONB';
    if (typeStr.includes('BLOB')) return 'BLOB';
    if (typeStr.includes('UUID')) return 'UUID';
    
    return 'STRING'; // Default to STRING if type is unknown
}

module.exports = {
    getSequelizeType
};
