// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

'use strict';

const TYPE_INTEGER = 'INTEGER';
const TYPE_BIGINT = 'BIGINT';
const TYPE_SMALLINT = 'SMALLINT';
const TYPE_REAL = 'REAL';
const TYPE_TEXT = 'TEXT';
const TYPE_BLOB = 'BLOB';
const TYPE_BOOLEAN = 'BOOLEAN';
const TYPE_DATE = 'DATE';
const TYPE_JSON = 'JSON';
const TYPE_ARRAY = 'ARRAY';

class MemoryDataType {
    constructor(name) {
        this.name = name;
        this.key = name;
        this[Symbol.hasInstance] = (instance) => Boolean(instance && instance.key === this.key);
    }

    toSql() {
        if (this.name === TYPE_BIGINT || this.name === TYPE_SMALLINT) {
            return TYPE_INTEGER;
        }
        if (this.name === TYPE_BOOLEAN) {
            return TYPE_INTEGER;
        }
        if (this.name === TYPE_JSON || this.name === TYPE_ARRAY) {
            return TYPE_TEXT;
        }
        if (this.name === TYPE_DATE) {
            return TYPE_TEXT;
        }
        if (this.name === TYPE_BLOB) {
            return TYPE_BLOB;
        }
        if (this.name === TYPE_REAL) {
            return 'REAL';
        }
        return TYPE_TEXT;
    }
}

function createType(name) {
    return new MemoryDataType(name);
}

const DataTypes = {
    INTEGER: createType(TYPE_INTEGER),
    BIGINT: createType(TYPE_BIGINT),
    SMALLINT: createType(TYPE_SMALLINT),
    FLOAT: createType(TYPE_REAL),
    DOUBLE: createType(TYPE_REAL),
    DECIMAL: createType(TYPE_REAL),
    NUMBER: createType(TYPE_REAL),
    STRING: createType(TYPE_TEXT),
    TEXT: createType(TYPE_TEXT),
    CHAR: createType(TYPE_TEXT),
    BLOB: createType(TYPE_BLOB),
    BOOLEAN: createType(TYPE_BOOLEAN),
    DATE: createType(TYPE_DATE),
    DATEONLY: createType(TYPE_DATE),
    JSON: createType(TYPE_JSON),
    JSONB: createType(TYPE_JSON),
    ARRAY: createType(TYPE_ARRAY),
    NOW: {
        key: 'NOW'
    }
};

module.exports = {
    DataTypes
};
