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

const TYPE_STRING = 'string';
const TYPE_NUMBER = 'number';
const TYPE_INTEGER = 'integer';
const TYPE_FLOAT = 'float';
const TYPE_BOOLEAN = 'boolean';
const TYPE_DATE = 'date';
const TYPE_DATETIME = 'datetime';
const TYPE_JSON = 'json';
const TYPE_OBJECT = 'object';
const TYPE_ARRAY = 'array';
const TYPE_BUFFER = 'buffer';
const TYPE_DEFAULT = 'default';

const TRUE_VALUES = new Set(['true', '1', 'yes', 'y', 'on']);
const FALSE_VALUES = new Set(['false', '0', 'no', 'n', 'off']);

let sharedTypeConverter = null;

function isNil(value) {
    return value === null || value === undefined;
}

function normalizeType(type) {
    if (!type) {
        return TYPE_DEFAULT;
    }
    return String(type).trim().toLowerCase();
}

function cloneValue(value) {
    if (value === null || value === undefined) {
        return value;
    }
    if (Array.isArray(value) || typeof value === 'object') {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            return value;
        }
    }
    return value;
}

class TypeConverter {
    constructor(options = {}) {
        this.converters = new Map();
        this.defaultTimezone = options.defaultTimezone || 'UTC';
        this.registerDefaultConverters();
    }

    registerDefaultConverters() {
        this.register(TYPE_STRING, (value) => {
            if (isNil(value)) {
                return value;
            }
            if (typeof value === 'object') {
                return JSON.stringify(value);
            }
            return String(value);
        });

        this.register(TYPE_NUMBER, (value) => {
            if (isNil(value) || value === '') {
                return null;
            }
            const numberValue = Number(value);
            return Number.isNaN(numberValue) ? null : numberValue;
        });

        this.register(TYPE_INTEGER, (value) => {
            if (isNil(value) || value === '') {
                return null;
            }
            const numberValue = Number.parseInt(value, 10);
            return Number.isNaN(numberValue) ? null : numberValue;
        });

        this.register(TYPE_FLOAT, (value) => {
            if (isNil(value) || value === '') {
                return null;
            }
            const numberValue = Number.parseFloat(value);
            return Number.isNaN(numberValue) ? null : numberValue;
        });

        this.register(TYPE_BOOLEAN, (value) => {
            if (isNil(value)) {
                return null;
            }
            if (typeof value === 'boolean') {
                return value;
            }
            if (typeof value === 'number') {
                return value !== 0;
            }
            const normalized = String(value).trim().toLowerCase();
            if (TRUE_VALUES.has(normalized)) {
                return true;
            }
            if (FALSE_VALUES.has(normalized)) {
                return false;
            }
            return null;
        });

        this.register(TYPE_DATE, (value) => {
            if (isNil(value) || value === '') {
                return null;
            }
            if (value instanceof Date) {
                return value.toISOString().split('T')[0];
            }
            const parsed = new Date(value);
            if (Number.isNaN(parsed.getTime())) {
                return null;
            }
            return parsed.toISOString().split('T')[0];
        });

        this.register(TYPE_DATETIME, (value) => {
            if (isNil(value) || value === '') {
                return null;
            }
            if (value instanceof Date) {
                return value.toISOString();
            }
            const parsed = new Date(value);
            if (Number.isNaN(parsed.getTime())) {
                return null;
            }
            return parsed.toISOString();
        });

        this.register(TYPE_JSON, (value) => {
            if (isNil(value) || value === '') {
                return null;
            }
            if (typeof value === 'string') {
                try {
                    return JSON.parse(value);
                } catch (error) {
                    return null;
                }
            }
            return cloneValue(value);
        });

        this.register(TYPE_OBJECT, (value) => {
            if (isNil(value)) {
                return null;
            }
            if (typeof value === 'object') {
                return cloneValue(value);
            }
            if (typeof value === 'string') {
                try {
                    return JSON.parse(value);
                } catch (error) {
                    return { value };
                }
            }
            return { value };
        });

        this.register(TYPE_ARRAY, (value) => {
            if (isNil(value)) {
                return [];
            }
            if (Array.isArray(value)) {
                return cloneValue(value);
            }
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                    try {
                        return JSON.parse(trimmed);
                    } catch (error) {
                        return [trimmed];
                    }
                }
                if (trimmed.includes(',')) {
                    return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
                }
            }
            return [value];
        });

        this.register(TYPE_BUFFER, (value) => {
            if (isNil(value)) {
                return null;
            }
            if (Buffer.isBuffer(value)) {
                return value;
            }
            if (typeof value === 'string') {
                return Buffer.from(value, 'utf8');
            }
            if (Array.isArray(value)) {
                return Buffer.from(value);
            }
            return Buffer.from(String(value), 'utf8');
        });

        this.register(TYPE_DEFAULT, (value) => value);
    }

    register(targetType, handler) {
        const normalizedType = normalizeType(targetType);
        this.converters.set(normalizedType, handler);
    }

    unregister(targetType) {
        const normalizedType = normalizeType(targetType);
        this.converters.delete(normalizedType);
    }

    has(targetType) {
        const normalizedType = normalizeType(targetType);
        return this.converters.has(normalizedType);
    }

    convert(value, targetType, options = {}) {
        const normalizedType = normalizeType(targetType);
        const handler = this.converters.get(normalizedType) || this.converters.get(TYPE_DEFAULT);
        if (!handler) {
            return value;
        }
        try {
            const converted = handler(value, options);
            if (options.nullFallback !== undefined && converted === null) {
                return options.nullFallback;
            }
            return converted;
        } catch (error) {
            if (options.strict) {
                throw error;
            }
            return options.onError !== undefined ? options.onError(error, value) : null;
        }
    }

    mapRowTypes(row, schemaDefinition = {}, options = {}) {
        if (!row || typeof row !== 'object') {
            return {};
        }
        const convertedRow = {};
        for (const [column, columnDefinition] of Object.entries(schemaDefinition)) {
            const targetType = columnDefinition.type || columnDefinition;
            const value = row[column];
            convertedRow[column] = this.convert(value, targetType, options);
        }
        return convertedRow;
    }

    convertRowWithFallback(row, schemaDefinition = {}, options = {}) {
        const convertedRow = this.mapRowTypes(row, schemaDefinition, options);
        for (const [key, value] of Object.entries(row)) {
            if (!(key in convertedRow)) {
                convertedRow[key] = cloneValue(value);
            }
        }
        return convertedRow;
    }
}

function getTypeConverter() {
    if (!sharedTypeConverter) {
        sharedTypeConverter = new TypeConverter();
    }
    return sharedTypeConverter;
}

module.exports = {
    TypeConverter,
    getTypeConverter,
    TYPE_STRING,
    TYPE_NUMBER,
    TYPE_INTEGER,
    TYPE_FLOAT,
    TYPE_BOOLEAN,
    TYPE_DATE,
    TYPE_DATETIME,
    TYPE_JSON,
    TYPE_OBJECT,
    TYPE_ARRAY,
    TYPE_BUFFER
};
